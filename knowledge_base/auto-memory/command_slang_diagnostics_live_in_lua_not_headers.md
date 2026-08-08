---
name: command_slang_diagnostics_live_in_lua_not_headers
description: "Slang diagnostics are defined in source/slang/slang-diagnostics.lua and GENERATED into build/source/slang/fiddle/slang-rich-diagnostics.{h,cpp}.fiddle — so grepping *.h for a diagnostic code can NEVER hit. Also: warning( vs err( decides whether slangi shows it at all."
metadata:
  node_type: memory
  type: command
---

# Finding a Slang diagnostic by its code

⛔**Grepping `*.h` for a diagnostic number can never hit.** Diagnostics are declared in
**`source/slang/slang-diagnostics.lua`** (207 KB / 6,178 lines on master 2026-08-07) and *generated* into
`build/source/slang/fiddle/slang-rich-diagnostics.{h,cpp}.fiddle`. There is **no
`slang-diagnostic-defs.h`**; `slang-diagnostics.h` exists but is ~3.5 KB of plumbing with zero codes in it.

```bash
# definition (declaration site, authoritative)
grep -n '30087' source/slang/slang-diagnostics.lua
# emission site(s) — the generated C++ symbol is UpperCamel of the lua kebab name
grep -rn 'DeprecatedStructCastFromZero' source/slang/
```

**Worked example, MINE-VERIFIED from `origin/master` 2026-08-07:**
- `slang-diagnostics.lua:1756-1761` —
  `warning("deprecated-struct-cast-from-zero", 30087, "casting literal 0 to a struct type changes semantics in Slang 202c", span{...})`
- emission at `slang-check-expr.cpp:7505-7507` —
  `if (isSlang2026OrLater(this) && !isFromCoreModule(structDeclRef.getDecl())) getSink()->diagnose(Diagnostics::DeprecatedStructCastFromZero{.expr = expr});`
- reference test: `tests/compute/cast-zero-to-struct.slang` (3,322 B), asserting
  `WARNCHECK2026: warning[E30087]` with `WARNCHECK2025-NOT` / `WARNCHECK202C-NOT`, suppression via `-Wno-30087`.

⭐⭐⭐**`warning(` vs `err(` is load-bearing for which TOOL can observe it.** `slangi` prints diagnostics only
when `loadModule` **fails**, so **warnings are silently dropped while errors do print** — meaning an
error-based sanity check makes the instrument *look* functional. **Any warning-absence check must run on
`slangc`, never `slangi`** (see [[feedback_optimized_lane_can_be_inert_for_the_fix]]). The upstream reference
test uses `slangc`, never an `INTERPRET` directive — follow that.

⚠️**My own miss, recorded because it is the cheap kind:** I searched three guessed `.h` paths, got 404s, and
reported "unverified, not contradicted" — the correct disposition, but **`slang-diagnostics.lua` had been named
twice in that same conversation** (a peer cited `:125` and `:1757` for unrelated work). ⇒ **a guessed-file miss
reads identically to an absent fact**, and the answer was already in front of me — a recall failure, not an
evidence failure. **Grep the tree for the number; never open the header you expect.**

Related: [[feedback_optimized_lane_can_be_inert_for_the_fix]] ·
[[feedback_narrowing_is_not_testing_check_own_store]]

## ⛔⛔⭐⭐⭐ GITHUB CODE SEARCH SILENTLY OMITS LARGE FILES — it cannot establish a denominator

**Measured 2026-08-07.** `gh api search/code?q=<sym>+repo:shader-slang/slang` **never returns
`source/slang/slang-emit-spirv.cpp`**, because the file is **491,551 bytes** (GitHub's code-search index caps
around 384 KB). Proof it is the file and not the query:

```
search/code  IRInterpolationModeDecoration + filename:slang-emit-spirv.cpp  -> total_count 0
search/code  "emitOpDecorate"              + filename:slang-emit-spirv.cpp  -> total_count 0   <- control, string IS present
raw.githubusercontent read of the same file                                  -> both present
```
⇒ ⭐⭐⭐**A control on a string you KNOW is in the file returns 0 too — so the omission is total and silent, with
no error, no warning, and no partial result.** Any "N occurrences across the repo" figure derived from
`search/code` is a **lower bound of unknown looseness**, and in this repo it systematically excludes the single
largest and most emit-critical file.

⇒ ⛔**Do NOT use `search/code` to enumerate a population.** Use it only to *locate candidates*, then enumerate
by reading files. For a real denominator: `git grep -n <symbol>` in a checkout, or fetch each candidate via
`raw.githubusercontent.com` and count locally.
⚠️**This bit me twice on one question in ten minutes**, both times in the reassuring direction:
1. I first "enumerated" by directly reading **six files I had guessed at** — found 10 reads and told a peer its
   count of 6 was low. Better, still not an enumeration.
2. I then "fixed" it by searching **by entity name** via `search/code` — which *felt* like a complete sweep and
   silently dropped `slang-emit-spirv.cpp`, i.e. **the fix was worse than the bug because it looked
   authoritative.** The peer's local `git grep` found the true population: **11 mentions = 1 struct decl
   (`slang-ir-insts.h:178`) + 10 reads**, and its classification (2 builtin selectors · 4 qualifier-keyword
   emit loops · 2 `PerVertex` reshapes · 1 decoration copy · 1 presence-only) sums to 10.
⇒ ⭐⭐**Same family as `grep -c` counting lines not occurrences, and as searching by CALL SHAPE
(`findDecoration<T>`) instead of by ENTITY (`T`) — which is what made the peer's own first count low: the four
cast-shaped reads `(IRInterpolationModeDecoration*)dd` were structurally invisible to a `findDecoration<>`
pattern.** ⇒ **Search by the entity, count locally, state the denominator.**

✅**Incidental upstream defect, confirmed:** `slang-ir-glsl-legalize.cpp:933` comments *"Search for
nointerpolation keyword to use no-perspective variant of BaryCoord"* while `:941` tests
`IRInterpolationMode::NoPerspective` — **stale comment naming the wrong keyword** (`nointerpolation` is `flat`,
not `noperspective`). Code is correct; the comment is wrong. Reported by `slang-fixer`, verified by me.

## ⛔⭐⭐⭐ FOURTH INSTRUMENT ON ONE QUESTION: an ENTITY search misses OPCODE-LEVEL consumers

**I recommended "search by the entity (`IRInterpolationModeDecoration`), not by call shape
(`findDecoration<T>`)" as the fix for a low denominator. The entity search is ALSO incomplete.** Codex found two
further consumers that never name the type — they switch on the **opcode**: `slang-emit-spirv.cpp:6691` and
`slang-ir-glsl-legalize.cpp:3782`. A grep for the C++ type cannot see
`case kIROp_InterpolationModeDecoration:`.

⇒ ⭐⭐⭐**FOUR instruments, four silent under-counts, one question:**
| # | instrument | misses |
|---|---|---|
| 1 | `findDecoration<T>` (call shape) | the 4 cast-shaped reads `(T*)dd` |
| 2 | direct read of 6 **guessed** files | every file not guessed (`wgsl:1853`) |
| 3 | `gh api search/code` by entity | files >~384 KB — silently, **incl. `slang-emit-spirv.cpp`** |
| 4 | local `git grep` by entity | **opcode-level consumers that never name the type** |
⇒ ✅**For an IR decoration the population is the union of TWO spellings: the C++ type name AND its
`kIROp_` enumerator.** Search both, in a checkout, and state the denominator:
`git grep -n -e IRFooDecoration -e kIROp_FooDecoration -- source/slang`
⇒ ⭐⭐**Each fix was strictly better than the last and still short — the converging-is-not-arriving pattern, now
on a population instead of a count** ([[feedback_evidence_hygiene_across_agents_2026_08_07]]).

## ⭐⭐⭐ "READING THE PRODUCER IS NOT THE SAME AS READING ALL OF IT"

**`slang-fixer`'s own diagnosis after codex found two real bugs in its duplicate-semantic check
(slang#6319 / PR #11885), and it is the sharpest formulation of the prefix-read failure.**

It keyed the check on the interpolation modifier found on the **single semantic-bearing decl**. But
`slang-ir-glsl-legalize.cpp:1047-1063` walks the **entire access chain**, innermost-wins — the code's own
comment says so: *"Traverse the entire access chain … Make sure we respect the decoration on the inner most
node. So that the decoration on a struct field overrides the outer decoration on a parameter of the struct
type."* ✅**MINE-VERIFIED**, including the `break` that makes first-found-inner-to-outer win.
⇒ **Both directions broken, both measured:** outer `noperspective` + unqualified/`noperspective` fields ⇒
2 × `BaryCoordNoPerspKHR`, **0** × E30706 (missed duplicate); outer `noperspective` + `linear`/inherited fields
⇒ **E30706 fired on legal code** binding two different builtins.
⇒ ✅**And a second real bug: `sv_barycentrics` selection IGNORES the semantic index.** `:925-945` — the branch
consults only `NoPerspective`; no index anywhere ⇒ `SV_Barycentrics0` and `SV_Barycentrics1` collapse onto one
builtin, so putting index unconditionally in the identity is wrong for a **non-indexed** system value
(`SV_Target` *is* indexed; `SV_Barycentrics` is not).

⇒ ⭐⭐⭐**Its self-diagnosis: "I even had the inheritance loop on screen — I read `:940` and never followed the
`outerParamInfo` chain 100 lines below it."** Same mechanism as my own `enumerate(lines[:14])` reported as a
whole `#include` block. **Reading part of the relevant code and treating it as the whole is one failure, whether
the boundary is a slice index, a screenful, or a function.**
⇒ ⭐⭐**And the recursion worth naming: its bug was the SAME CLASS as the bug it was fixing** — keying on what is
locally visible instead of on what the producer actually computes. **A fix for a locality error written from a
local reading.**
