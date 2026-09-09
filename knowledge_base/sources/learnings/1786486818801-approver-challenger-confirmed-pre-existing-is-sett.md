---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-11T22:20:18.801Z
---

# [approver/challenger-confirmed] "Pre-existing?" is settled by a base-blob diff, and it cuts BOTH ways — a refactor that preserves gating semantics doesn't own a latent bug it merely restructures

**Context:** slang-rhi#831 R5 @86c2a9c3e0ba. R4 abstained on two challenger gaps. R5 resolved the decision by settling both with a diff against the **PR base** (`gh pr view --json baseRefOid` → `632b0aee`; read files at base via `contents?ref=<base>`), not by re-reasoning from the head alone.

**Gap #2 (action "pinned" contract mismatch):** the R4→R5 blob diff of `action.yml` showed the description changed from "Installs a **pinned** Mesa lavapipe" → "Installs **the** Mesa lavapipe". Fixed by correcting the contract (the option Devin/codex named). Note: at R4 I had wrongly dismissed this as "pre-existing" — it was newly-added by the PR. That was the mistake.

**Gap #1 (`vk-heap.cpp`: `SHADER_DEVICE_ADDRESS` usage bit gated on the *enabled* `bufferDeviceAddress` feature, but `vkGetBufferDeviceAddress` call gated only on the *loaded proc*):** a deep trace confirmed a realizable VUID-violation path on the **external-device** path (slang-rhi mirrors `m_extendedFeatures` from physical-device *support* via `vkGetPhysicalDeviceFeatures2`, not from the imported `VkDevice`'s *enabled* features — `device.cpp`). BUT the base-blob diff proved this divergence is **pre-existing**: at base `632b0aee`, `vk-heap.cpp` already gated usage on the enabled feature (base:21-23) and called `vkGetBufferDeviceAddress` under the proc-only guard (base:67,73), and `allocatePage` (base:146) already invoked `offsetToAddress→vkGetBufferDeviceAddress` under that same proc-only guard. The PR only **restructures** PageImpl (ctor→fallible `init()`, over-allocate+align, `Result` vs assert) with **identical gating conditions**. The root cause is in `device.cpp` (untouched by this PR).

**The transferable rule:** whether a flagged issue blocks *this* PR turns on "did this PR introduce or worsen it?" — and the only reliable way to answer is to diff the relevant file/lines against the **PR base commit** (not the prior revision, not the head in isolation). This cuts BOTH ways: it catches a newly-added defect you might wave off as pre-existing (R4 Gap #2), AND it exonerates the PR from a genuine latent bug it merely restructures without changing the semantics of (R5 Gap #1). A refactor that preserves the exact gating conditions on the supported path does not take ownership of a pre-existing latent bug on an untested path — that's a separate producer-side (`device.cpp`) issue for its own ticket. When the base-diff shows semantics preserved and the risk lives in untouched producer code, it's advisory (flag a separate issue), not an OPEN_GAP for this PR.

**Decision:** with Gap #2 fixed and Gap #1 proven pre-existing/out-of-scope, and full lavapipe CI green (one unrelated infra flake: Squid 503 on the slang-zip download), the change achieves its stated purpose with no new verified defect → WOULD_APPROVE (critique-gated). Caution retained: routed the scope reasoning through the DECISION_REVIEW/OUTPUT_REVIEW critique because a false-approve is the highest-severity error and R4 had just caught me over-approving on green CI.
