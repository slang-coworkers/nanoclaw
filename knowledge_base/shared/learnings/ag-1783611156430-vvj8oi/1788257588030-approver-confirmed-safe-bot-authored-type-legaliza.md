---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787696024779-qcaeit
written_at: 2026-09-01T10:13:08.030Z
---

# [approver/confirmed-safe] bot-authored type-legalization crash-fix (narrow producer-side + completed switch cases) merged unchanged

**Outcome (calibration join).** shader-slang/slang#12719 — WOULD_APPROVE (Devin-only tier, bot-authored `nv-slang-bot[bot]`). Merged by `tangent-vector` at `cd8af4f0bb06`, the exact commit I decided on → merged **unchanged**, zero follow-up commits. Decision CONFIRMED (merged ⇒ APPROVED-equivalent).

**Transferable signal — this *shape* of change is safe to approve when these hold:**
A GPU-target crash-fix in Slang IR type legalization that is (a) a **narrow producer-side classification fix** — here a helper (`isArrayOfParameterGroupsNeedingLegalization`) that only *excludes* a specific over-broad shape from an existing "resource is legal as-is" shortcut, with every other input (bare resource arrays, bytes-only, Metal ParameterBlock) provably unchanged — plus (b) **completing existing `switch` cases** to handle a newly-reachable-but-valid flavor by *mirroring the established twin* (`legalizeGetElement` value-path `implicitDeref` mirrors `legalizeGetElementPtr`) and *fixing a dormant infinite recursion* (recurse on `->valueType` like the neighboring pair/tuple arms). None of these add a guard that *masks* malformed IR; they make the representation consistent at the producer.

**What made it approvable (the checks that carried the decision):**
1. The new code path is exercised by a **genuine positive-control test**: pre-fix behavior was a crash (no output → FileCheck fails), and the test asserts the emitted artifact (`OpTypeArray %int_1`, `OpTypeSampledImage`, `OpImageSampleImplicitLod`, GLSL `sampler2D[1]`) on **GPU-free targets** (`spirv-asm` + `glsl` via glslang) so it actually runs in CI without a GPU. A byte-identical revert-drill would NOT have sufficed, but a crash→compiles transition on a meaningful assertion does.
2. The "dead code was truly dead" argument is sound when the old code would **unconditionally crash** on any reachable input (infinite recursion / stack overflow): if the tree didn't already crash, the case was never hit, so the fix only affects a previously-crashing shape.
3. Out-of-scope regressions were **honestly disclosed and non-regressing**: multi-dim arrays moved crash→spirv-val-failure (a lateral move on an already-broken, unsupported shape), documented as a separate pre-existing gap. Clears — it does not undermine the single-dim fix that is the issue's stated purpose.

**Recall cue for next time:** when Step-0 surfaces this note on a type-legalization / `LegalType`/`LegalVal` flavor change, the highest-value probes are (1) is the new path a positive-control test on a GPU-free target, (2) does any new helper only *narrow* (exclude) rather than broadly re-route, and (3) is any newly-handled switch case a faithful mirror of an existing twin — not a novel guard.
