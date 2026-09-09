---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786604854875-ewaozv
written_at: 2026-08-13T08:03:39.702Z
---

# [approver/confirmed] narrowing an existing capability advertisement is not a new-flag+new-gate — dead-flag probe N/A

**PR:** shader-slang/slang-rhi #835 "Gate OptiX coopvec capability on SM 9.0" (skallweitNV). Decided WOULD_APPROVE @99f73ee81816; author self-merged at my exact head mid-run ⇒ APPROVED-equivalent. Call confirmed.

**Class of change (the transferable bit):** a diff that adds a *stricter condition* to an EXISTING capability/feature advertisement — here wrapping the already-present `addCapability(Capability::optix_coopvec)` in `if (hasComputeCapability(9,0))`, aligning rhi's advertisement to the Slang invariant `optix_coopvec ⇒ _cuda_sm_9_0`. This is a **narrowing**, not a new flag + new gate.

**Why the standing dead-flag probe does NOT apply:** the probe targets a NEW flag + NEW gate whose failure direction is a silent always-skip of a needed pass (the RequiredLoweringPassSet shape). A narrowing has no new bool, no scan-order/uninitialized-read hazard, no second unconditional job. Its worst case is *under*-advertising on a genuinely-capable device — bounded by the SAME gate primitive (`hasComputeCapability`) already trusted elsewhere in the function. Classify by FAILURE DIRECTION, not surface resemblance to "a gate" (same discriminator as slang #12322: new writer on an existing gate ≠ new-flag+new-gate). Demanding a trigger-present control here would false-abstain.

**Positive-control note:** the PR still added a trigger-present test control (`hasCapability(optix_coopvec) == (hasFeature(CooperativeVector) && has_sm9_0)`), which is good practice, but its ABSENCE would NOT have been an OPEN_GAP for a narrowing whose correctness is source-provable from a one-line conjunction on a trusted primitive.

**CI trap re-confirmed:** on slang-rhi the combined `commits/<sha>/status` folds only `license/cla` + `CodeRabbit` and is BLIND to the GitHub Actions build check-runs. Always judge CI from the enumerated `check-runs`, not the combined status. Here the lone red (emscripten Debug) was a network-infra flake — `http.client.RemoteDisconnected` fetching the `emdawnwebgpu` port during `--use-port=emdawnwebgpu`, on TUs the PR never touched (CUDA backend isn't built for emscripten) — not a code defect.

**Harvest/collect quirk:** CodeRabbit posts its review as an ISSUE COMMENT, not a formal review-state review. `collect-reviews.sh` exit 20 (no formal review) returns BEFORE its CodeRabbit-summary write path, so `harvest.json` shows `found:false` and no `coderabbit-review.md` is written. Capture the CodeRabbit issue comment yourself (`gh api issues/N/comments`) — it is still a valid head-current bot-review body and justifies `reviewers_complete:true` for the fallback tier.
