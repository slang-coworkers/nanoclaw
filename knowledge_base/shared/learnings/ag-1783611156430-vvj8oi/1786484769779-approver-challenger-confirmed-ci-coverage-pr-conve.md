---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-11T21:46:09.779Z
---

# [approver/challenger-confirmed] CI-coverage PR converges to WOULD_APPROVE only when ALL its own new jobs go green — track it per-revision via check-runs

**Context:** slang-rhi#831 "CI with lavapipe" (@skallweitNV, MEMBER) — a rapid 4-revision chain, all gated by re-enumerating the PR's own new `lavapipe` matrix jobs via `check-runs` (never the folded combined `/status`, which only carries {license/cla, CodeRabbit} here). Decision trajectory:
- R1 @eb1f6ce166da: ABSTAIN_POLICY(OPEN_GAP) — 2/4 lavapipe red (texture-copy round-trip fails; AS SIGSEGV).
- R2 @fd72d68f3cbe: ABSTAIN_POLICY(OPEN_GAP) — root-cause fix landed (getTextureRowAlignment→blockSize; calcAligned2→calcAligned), fixed linux-x86_64, but 3/4 red: aarch64 SIGSEGV in a *different* unguarded AS test, both Windows "vkCreateInstance: Found no drivers!".
- R3 @a5b1e941: superseded in-flight by R4 (gated current head per orchestrator's "one authoritative verdict against latest head").
- R4 @8d36ccf57ed4: **WOULD_APPROVE** — all 4 lavapipe jobs green + full CI green (29 check-runs, 26 success/3 skipped/0 failure; `ci` workflow run completed/success, attempt=1).

**The transferable rule:** for a "add CI coverage for X" PR, the decision is a pure function of whether the coverage it introduces is *fully* green — and that only converges when EVERY new job across the arch×OS matrix passes. Track it per revision with the same mechanical probe each time: enumerate `repos/<r>/commits/<head>/check-runs --paginate`, tally conclusions, and confirm `total_count == fetched` (truncation guard) plus the `actions/runs?head_sha=` run-level `status/conclusion` with `run_attempt` (a real attempt=1 green, not a rerun-manufactured one). "Green on one config" is never "green"; the failure set shifts between revisions (one config fixed while another regresses — R2's windows-x86_64 had passed in R1).

**What earned the WOULD_APPROVE (not just green CI):** the diff also had to be principled with no verified defect — verified `calcAligned` (division, arbitrary alignment) is correct vs `calcAligned2` (asserts isPowerOf2) for non-power-of-two block sizes; the `vk-heap` PageImpl refactor (fallible `init()` over-allocating by alignment-1, computing base address once, returning `Result` instead of asserting) is a sound root-cause change; the AS-test `Feature::SoftwareDevice` SKIPs are legitimate capability guards. Devin (exit 0) found 0 bugs/0 flags; its 2 substantive informational items were cleared advisory (a zero-alignment div-by-zero unreachable on the supported path; a defensive void-method early-return matching the file's layer-error pattern). Green CI + clean principled diff + no open gap = the full conjunction. Under v0-shadow-wide, `.github/**` is not protected and `require_ci_green` is off, so CI-green is a Step-3 challenger judgment, not a Step-1 clause — but I still required the full matrix green before approving.
