---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T19:14:47.112Z
---

# [approver/challenger-method] Measure a linkage/ODR claim by symbol BINDING (readelf -sW), not by the language rule — and nm presence is the wrong instrument

## Symptom

A PR whose entire value is a claim about **what the compiler emits** (here:
slang#12452, `include/slang.h`, two constants `inline constexpr` →
`static constexpr` to fix mixed-AddressSanitizer ODR violations). The tempting
review path is to check the claim against the language rule ([dcl.link]/7,
[basic.link]/3.2) and move on. That path gets two things wrong, and both are
cheap to catch by measuring.

## Root cause / what measurement corrected

Built the real header two ways — AFTER (as-shipped) and BEFORE (synthesized by
reverting just the two spellings) — then compared symbol tables:

| use shape | BEFORE (`inline constexpr`) | AFTER (`static constexpr`) |
|---|---|---|
| value-read only | **no symbol emitted** | 2 × `LOCAL` (`_ZL19kDefaultTargetFlags`) |
| address-ODR-used, g++ 12 | `UNIQUE` (cross-module) | `LOCAL` |
| address-ODR-used, clang 14 **+ASan** | `WEAK`, size **4** | `LOCAL`, size **32** (4 + 28 redzone) |

1. **"`inline constexpr` emits a shared global" is only true under an
   address-ODR-use.** With value-read-only uses — the actual in-tree shape — the
   BEFORE state emitted *no symbol at all*, while AFTER emitted two `LOCAL` ones.
   So a naive symbol-presence check makes a correct fix look **backwards**
   (0 symbols "before", 2 "after").
2. **`nm` presence is the wrong instrument; binding is the signal.** `nm`'s
   lowercase-`r`-vs-`R` distinction is easy to skim past. `readelf -sW` prints
   the binding column outright: the real transition is
   `WEAK`/`UNIQUE` → `LOCAL`. Internal-linkage symbols are still *present*
   (mangled `_ZL<len><name>`), which is why "no emitted global" — the phrasing
   in both the PR body and the bot review — is loose even though the fix is right.

The clang+ASan row is the mechanism the PR describes, observed end to end: the
redzone inflates the recorded size of a **cross-module `WEAK`** symbol, and that
size is what ASan's ODR checker compares against a non-instrumented library's
4-byte copy. `static` makes it `LOCAL`, removing it from cross-module comparison
entirely — the failure becomes structurally impossible rather than suppressed.

## How to catch it

For any linkage / ODR / visibility / symbol-emission PR (~4 commands, no build
of the project needed — compile a tiny TU against the real header):

```sh
# AFTER
printf '#include "slang.h"\nconst auto* p(){ return &kDefaultTargetFlags; }\n' > u.cpp
g++ -std=c++17 -O0 -c u.cpp -o after.o -I.
readelf -sW after.o | grep -i '<name>'       # binding column: LOCAL vs WEAK/UNIQUE/GLOBAL
# BEFORE: copy the header, revert just the changed spelling, rebuild, compare
# ASan variant, where the size difference shows up:
clang++ -std=c++17 -fsanitize=address -O0 -c u.cpp -o asan.o -I.
```
Write **two** TUs — one value-read-only, one address-taken. They answer different
questions, and only the address-taken one exhibits the emission the claim is about.

**The safety predicate is a one-line grep.** Internal linkage is safe iff no use
takes the address or binds a reference; a *value* read is fine even from a header,
via the [basic.def.odr] exception for internal-linkage const objects named in a
class definition. So:

```sh
grep -rn '&\s*<name>' .      # 0 hits => the ABI question is answered
```
On #12452: 22 uses, **0 address-taken**; the only ODR-interesting ones were two
default member initializers in headers (value reads ⇒ exception applies).
Confirmed by a two-TU compile+link+run under
`ASAN_OPTIONS=detect_odr_violation=2` and `-Wall -Wextra` — clean, no
`-Wunused-const-variable` noise either (the usual objection to `static` in a header).

## Fix / transferable rule

**A claim about what the compiler emits is measurable in minutes — measure it.**
Reasoning from the standard tells you what *should* happen; the symbol table tells
you what *did*, and on this PR the two differed in presentation (though not in
conclusion) twice. Also: on g++ 12 a bare `constexpr` inside `extern "C"` measured
`LOCAL`, so a comment asserting `static` is *strictly required* there is stronger
than that compiler demonstrates — worth knowing before you either endorse or
challenge such a comment.

Corollary for the ABI question: a change under `include/` is **not** automatically
an ABI change. Check *which* invariant the diff engages — #12452 touched no enum
and no COM/virtual method, so the enum-ordering and vtable-layout rules were not
in play at all, despite `include/` being named in the tasking. Naming an invariant
is not evidence the diff triggers it.
