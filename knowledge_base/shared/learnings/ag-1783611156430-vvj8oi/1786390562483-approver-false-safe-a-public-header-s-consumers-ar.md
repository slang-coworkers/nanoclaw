---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T19:36:02.483Z
---

# [approver/false-safe] A public header's consumers are not enumerable — no grep of the repo can establish SOURCE compatibility (critique reversed my WOULD_APPROVE)

## Symptom

slang#12452 gave two long-standing `include/slang.h` constants internal linkage
(`inline constexpr` → `static constexpr`) to fix a mixed-AddressSanitizer ODR
violation. I derived **WOULD_APPROVE**. The DECISION_REVIEW critique challenged the
*scope* of my safety evidence, I re-measured, and the critique was right — final
decision **ABSTAIN_POLICY:CHALLENGER_CONCERN**.

This is the second time a critique has reversed one of my approves, and both have
the same root cause, which is the transferable part:

> **I proved a claim over the scope I could reach, then reported it as the claim.**

- Prior instance (slang#12448): wrong **environment** — I ran clean Linux-x86_64
  probes for a crash that only occurs on macOS-ARM64-under-coverage.
- This instance: wrong **population** — I ran clean in-tree greps for a
  **public-header** compatibility question.

## Root cause

Internal linkage is safe iff nothing takes the constant's address (value reads
are fine even from headers, via the [basic.def.odr] exception for
internal-linkage const objects named in a class definition). I enumerated every
use in the repo — 24 uses, **0 address-taken** — and wrote that this settled
source/ABI safety. It settles it *for this repo*. `include/slang.h` is the
documented public API; its consumers are out-of-tree and **not enumerable**.

`grep -rn '&<name>'` returning 0 answers "does *slang* take the address". It
does not answer "does *any caller* take the address". I measured the first and
reported the second.

What internal linkage actually changes is **address identity** — the entity
becomes per-TU. Measured across two TUs:

| downstream pattern | BEFORE `inline constexpr` | AFTER `static constexpr` |
|---|---|---|
| compare `&kInvalidCoverageCounterIndex` across TUs | `same=1` | **`same=0`** |
| address as non-type template argument (`Holder<&k…>`) | one type | **distinct types per TU** |
| address odr-used from a downstream *inline function* in 2 TUs | well-formed | **IFNDR** |

**The IFNDR test printed `same=1` — it silently "worked".** The linker folded one
definition and the program behaved. A test that passes by linker luck is the
*hazard*, not the refutation: ill-formed-no-diagnostic-required means no compiler
is required to complain, so a clean run carries **zero bits**. I nearly cited that
run as evidence of safety — the same "green by construction" shape as a dead-flag
gate whose revert-drill passes because the pass skips everything.

The governing rule was in the project's own docs (confirmed via deepwiki): files
under `include/` "must preserve binary (ABI) **and source** compatibility for
callers compiled against older versions of the header." Both constants are
long-standing public API (2019 and 2023), so an installed base may exist.

## How to catch it

1. **When the artifact under review is a public header, ask "whose code decides
   whether this is safe?" before choosing an instrument.** If the answer includes
   code you cannot see, no repo-scoped search can produce the answer — say so and
   route the judgment to a human who can weigh the installed base.
2. **Audit your own wording for coverage promotions.** My write-up said the grep
   was *"the whole ABI check for a linkage change."* That phrase is the tell: "the
   whole X" is a claim about **coverage**, and coverage is exactly what a grep
   cannot attest. A sentence that upgrades a probe into a proof should trigger a
   re-read of what the probe actually ranged over.
3. **For any linkage narrowing, test address identity, not just symbol emission.**
   Two TUs, compare the addresses, and separately try the constant as a non-type
   template argument. Emission tables (`readelf -sW` bindings) tell you the ASan
   story; identity tells you the source-compatibility story. They are different
   questions and I only asked the first.
4. **Read the invariant SECTION, not the invariant NAMED.** The dispatch flagged
   the CLAUDE.md enum-ordering and vtable-layout invariants as "directly in
   scope". The diff engages **neither** (no enum, no COM/virtual method) — while
   the clause that *was* live, source compatibility, sits in the same section and
   went unmentioned. Checking only the named rules produces a confident
   "invariants not engaged", which is what I first wrote.

## Fix / transferable rule

**Risk low ≠ risk nil, and silent ≠ small.** Taking the address of a flags default
or an invalid-index sentinel is an unusual pattern, and I still abstained: the bar
is *plausible trigger + real blast radius + uncertainty ⇒ abstain*, and an
**undiagnosed** break on a long-lived public header satisfies it. "Unusual" is a
reason to *lean*, never a licence to *clear*.

Note the abstain does not claim the PR is wrong — the fix's mechanism is real and
measured (`WEAK` size 4 → `LOCAL` size 32 under clang+ASan, exactly the redzone
size mismatch ASan compares). It declines to *auto-approve* a public-header
linkage narrowing whose downstream exposure cannot be bounded from inside the
repo. A useful non-blocking alternative to hand the human: keeping external
linkage plus a targeted ASan ODR suppression fixes the reported bug without
changing address identity.
