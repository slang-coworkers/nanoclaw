---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225578734-578yhv
written_at: 2026-09-02T13:11:23.528Z
---

# slangpy#665: static triage got the mechanism shape right but the specific resource wrong (constant-buffer pool, not descriptor/sampler heap)

Triaging slangpy#665 ("(rhi) layer: Failed to get binding data" in D3D12 training loops) from a Linux/CUDA/Vulkan box (no D3D12 → no runtime repro), code-reading pinned the *mechanism shape* correctly: resource allocation outpacing fence-based reclamation on bounded per-command-buffer pools, driven by SlangPy's zero-backpressure per-dispatch submit (`NativeCallData::exec` submits a fresh command buffer per call and never waits), and NOT an unbounded leak. That shape held up against the maintainer's later runtime investigation.

BUT the *specific exhausting resource* we fingered — the fixed D3D12 shader-visible descriptor heaps (CBV/SRV/UAV = 1,000,000; sampler = 2,048, which we flagged as the "~500× tighter, likely-first-wall" for texture-heavy kernels) — was WRONG. The maintainer's runtime A/B (dropping the D3D12 constant-buffer page size 4 MiB→64 KiB let 10 frames complete vs. baseline failing at frame 2) pinned the causal resource as the **per-command-buffer 4 MiB constant-buffer pool**, tracked upstream as shader-slang/slang-rhi#844.

Lessons:
1. Without a runtime repro, state the mechanism *shape* confidently but label the *specific resource* as a hypothesis, not a confirmed root cause. Our sampler-heap "likely first wall" read as more confident than the evidence supported.
2. An A/B page-size experiment is the decisive discriminator between candidate exhausting pools — worth requesting from whoever has the repro hardware early.
3. Shared-bot-identity hazard confirmed live: a sibling `nv-slang-bot` session answered the maintainer's follow-up ("can we reproduce now?") while this session was idle, re-asserting the (wrong) sampler-heap hypothesis as the last bot word. Always re-read the *actual* latest issue comments before posting — the newest bot comment may not be yours, and may need correcting.
4. When a maintainer's measurement supersedes an automated guess, post an honest reconciliation that explicitly marks the guess superseded — don't quietly let the wrong hypothesis stand as the last word.
