---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605693530-sgpqjn
written_at: 2026-08-31T18:44:56.759Z
---

# [approver/challenger-miss] Wave-aggregate count-equivalence is FALSE in fragment stages (helper lanes) — I cleared it "by construction"; human found the bug + the perf premise was untrue

**PR:** shader-slang/slang#11511 (wave-aggregate coverage counters, Fix #11509), Devin-only tier. My decision @15ec9b04 was ABSTAIN_POLICY:CHALLENGER_CONCERN (red CI). PR later CLOSED UNMERGED by human `jvepsalainen-nv` with the note "This PR is not needed."

**Symptom (challenger miss).** In Step-3 I explicitly CLEARED the count-equivalence-under-divergence concern: "equality is by-construction (same active lane set, same program point as per-lane path); reconvergence is a pre-existing wave-intrinsic property; opt-in diagnostic data, not compile correctness." The human found this is a REAL correctness bug.

**The bug I missed.** The lowering is `lc = WaveActiveCountBits(true); if (WaveIsFirstLane()) atomicAdd(slot, lc)`. In a FRAGMENT/pixel stage, **helper invocations** participate in wave ops (so they ARE counted by `WaveActiveCountBits(true)` and can be elected by `WaveIsFirstLane()`), but their stores/atomics have NO memory effect. Two silent-miscount modes:
- elected lane is a helper ⇒ the whole increment is discarded ⇒ **undercount**;
- elected lane is real but the addend counted helpers ⇒ **overcount**.
Silently-wrong counts — the worst failure mode for a coverage tool. **NOT Metal-specific**: helpers behave this way on Vulkan/SPIR-V (`gl_HelperInvocation`, `SPV_KHR_demote_to_helper_invocation`) and HLSL SM6.6 (`IsHelperLane()`) too — i.e. exactly the SPIR-V + HLSL≥SM6.0 targets the PR aggregates on and was motivated by. Only CUDA is exempt (no fragment stage). The gate `isCoverageWaveAggregationSupported` keys on target-family + profile ONLY — it has no stage/helper-lane awareness, so it can't tell a marker is fragment-reachable. No fragment test existed in the 10.

**Root cause of my miss.** My "same active lane set at the same program point" argument conflated *lanes active in the wave* (what `WaveActiveCountBits(true)` counts) with *lanes that perform an EFFECTIVE per-lane atomicAdd* (what the per-lane baseline sums). Helper lanes make those two sets differ. My Step-0 recall even flagged "exact counts under divergence are reconvergence-dependent (a real open question)" — I noted it and then TALKED MYSELF OUT of it with a by-construction hand-wave, never enumerating helper invocations.

**How to catch it (transferable).** For any wave/subgroup COLLECTIVE-op equivalence claim ("aggregated == per-lane by construction"), do NOT clear it on a program-point argument alone. Enumerate the ways the wave's active mask differs from the set of lanes with observable effect: **(1) helper invocations in fragment/pixel stages** (counted but no memory effect — check `IsHelperLane`/`gl_HelperInvocation`/demote), (2) divergent/reconvergent control flow, (3) whether the elected lane's write is even effective. A "by construction" claim about a collective op is a RED FLAG to probe stage-by-stage, not a proof. And require a per-STAGE trigger-present test (a fragment-stage regression here) — a claim that holds for compute but not fragment needs a fragment test to falsify it.

**Second miss — the perf premise.** I accepted the PR body's "~20–30× slowdown" motivation as given (UNTRUSTED PR-body data). The human's own measurement on the motivating GPU (issue #11509 comment) showed **no speedup** — the dominant lever is counters-inside-hot-loops, not how each increment is issued. Lesson: when a change's whole justification is a performance number, the number is a CLAIM to probe (which config? does the final lowering match the experiment? is there any workload where the win shows?), not a premise. A change that takes on a correctness hazard + real complexity for a benefit that didn't appear where measured should not be rounded toward approve.

**Near-miss note.** My recorded decision was ABSTAIN (red CI from stale `1ULL` tests), which happens to agree with the closed-unmerged outcome — but the CI-red saved me for the WRONG reason. Had CI been green I'd have recorded WOULD_APPROVE against this human-verified correctness bug = a false-safe. The lesson is the challenger miss, not the (accidentally-correct) final state.
