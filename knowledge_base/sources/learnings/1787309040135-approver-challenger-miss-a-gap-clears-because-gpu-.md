---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787252601504-evr6bh
written_at: 2026-08-21T10:44:00.135Z
---

# [approver/challenger-miss] A "gap clears because GPU-less CI" rationale is self-contradictory when the same PR's CI runs GPU lanes

## Symptom
On slang#12649 (NVRTC arch-resolution), my first challenger pass CLEARED the residual 🟡 coverage gap as "inherent to GPU-less CI, no real trigger" and landed WOULD_APPROVE — while the SAME investigation asserted "CI green across real CUDA/GPU/build lanes." DECISION_REVIEW (codex) caught the contradiction: you cannot both claim a path is untestable for lack of GPU AND cite passing GPU lanes as evidence of health. Corrected to ABSTAIN_POLICY(OPEN_GAP).

## Root cause
"GPU-less CI" is a real reason a behavioral path can be uncoverable — but it is FALSIFIED the moment the PR's own CI shows GPU lanes executing. The actual gap here was subtler and survives the correction: the new logic (NVRTC `sort()` invariant + `compile()` snap/clamp integration) DOES run on the CUDA lanes, but the only integration test (`ptx-arch-from-capability.slang`) is NO-OP-EQUIVALENT on current toolkits — its own comment admits it "would still pass if the resolution logic were removed." The trigger branches (snap-up between archs, clamp-down above ceiling) are unreachable via `-capability` because the highest capability atom (`cuda_sm_9_0`=90) equals the tested NVRTC ceiling (90) and every whole-number atom is an exact set-member. So: pure helper unit-tested ✓, but the integration is not distinguished from a no-op by any head-current test.

## How to catch it
When clearing a coverage 🟡 as "untestable", name the SPECIFIC reason and check it against the PR's CI matrix. Two distinct clear-reasons that must not be conflated:
(a) "path doesn't execute in CI" — REFUTED if the relevant lane runs (check the check-run names).
(b) "path executes but no test DISTINGUISHES correct behavior from a no-op / the trigger is unreachable on available toolkits" — this is the real, common shape for capability/arch/target-gated logic, and it does NOT clear on the conservative-lean bar when the surface implements the PR's stated purpose. Ask: "is there a test whose failure would catch this logic being silently removed?" If the author's own test comment says "would still pass if the logic were removed", that is a self-declared OPEN_GAP.

## Fix
For gate/flag/arch-resolution PRs where the trigger is unreachable on current toolkits (future-proofing): the pure transform can be unit-tested (good), but the INTEGRATION wiring (does the caller actually feed the queried set through the resolver and change the emitted output?) is the part that carries zero bits from a no-op-equivalent E2E test. Treat "only the pure function is tested + the E2E test is no-op-equivalent" as OPEN_GAP, not a clear — abstain and let a human accept the coverage posture. Ties to the standing gate/flag probe (a negative safety observation that could not have come out otherwise carries no bits) and to "unsupported-and-unchecked is the dangerous quadrant".
