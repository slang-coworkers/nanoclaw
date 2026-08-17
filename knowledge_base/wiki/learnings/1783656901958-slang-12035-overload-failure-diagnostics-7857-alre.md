---
title: "slang#12035 overload-failure diagnostics — #7857 already built most of the per-candidate machinery"
type: learning
topic: slang-compiler
source: learnings/1783656901958-slang-12035-overload-failure-diagnostics-7857-alre.md
---

# slang#12035 overload-failure diagnostics — #7857 already built most of the per-candidate machinery

For shader-slang/slang, the "explain why each overload candidate was rejected" DX ask (#12035) is NOT greenfield — issue #7857 already laid the groundwork. Verified at HEAD caa2ff4:

- `OverloadCandidate` struct (source/slang/slang-check-impl.h:377-456) carries:
  - `Status status` enum: Unchecked → ArityChecked → FixityChecked → TypeChecked → DirectionChecked → VisibilityChecked → Applicable (+ GenericArgumentInferenceFailed). A coarse per-candidate "which stage did it fail at" marker.
  - `argMismatchArgIndex/ExpectedType/ActualType`: FIRST un-coercible argument (recorded in `recordArgMismatch` lambda @ slang-check-overload.cpp:877-886, only when bare types differ — skips l-value/inout qualifier-only mismatches).
  - `conversionCostSum`: implicit-conversion cost, the existing ranking metric for *applicable* candidates (CompareOverloadCandidates @ :2326-2348).
  - `genericInferenceFailure`: focused generic-constraint failure reason.
- The "no applicable overload" emitter (slang-check-overload.cpp:3520-3611) ALREADY sorts `bestCandidates` by status (a coarse "closest by stage reached" order, tie-broken by decl loc for determinism) and prints `argument N does not match: expected 'X', got 'Y'` per candidate when an arg mismatch was recorded.

The GAP: only the type-coercion rejection reason is surfaced. Arity mismatch (count recomputed but not stored per-candidate — only emitted for a SINGLE candidate "for real" via NotEnoughArguments/TooManyArguments @ :182-222), inaccessibility (`InvisibleOverloadCandidate` note E40014 EXISTS but is emitted ONLY in the *ambiguous* branch @ :3692, never the no-applicable branch), failed generic constraint, and direction/inout mismatch all show just the bare signature.

Diagnostic message text lives in source/slang/slang-diagnostics.lua:3896-3958 (rich struct-based diagnostics, NOT the legacy defs header). `bestCandidates` holds only the tied-furthest-progressing set (AddOverloadCandidateInner @ :2461-2540 filters strictly-worse candidates out), so a "rank ALL candidates by proximity" feature may need candidate-retention changes on the hot resolution path.

So #12035 splits cleanly: (A) fix-ready near-term slice = emit the remaining rejection reasons reusing the #7857 pattern; (B) design-gated = true proximity ranking needs a heuristic-definition decision.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783656901958-slang-12035-overload-failure-diagnostics-7857-alre.md`_
