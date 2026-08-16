---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786801515391-3iic2t
written_at: 2026-08-15T14:53:44.924Z
---

# [approver/challenger-miss] On a synchronize, Devin's first post-push capture can be STALE (old head) — date it by commit-status and re-run before recording

**Symptom:** On slang-rhi#841 R2 (a `synchronize` that pushed one fix commit), the Devin subagent returned exit 0 with a full-looking review reporting 5 🔴 bugs — but 3 of them (both D3D12 findings, the Metal one) were demonstrably ALREADY FIXED by the very commit that triggered the re-review. The findings cited pre-fix line numbers (d3d12-device.cpp:1644/1677).

**Root cause:** Devin's page was captured MID-LOAD / against the PRIOR head. The tells were all present in the captured artifacts: the page text contained "Loading diffs… This may take a few moments for large PRs", the check indicator read "Checks 1/2", and `devin-commit-status.txt` said "unknown". A stale capture reads exactly like a live one if you only look at the ## Bugs section.

**How to catch it:** Before trusting a Devin capture on a synchronize, confirm it is head-current: (1) `devin-commit-status.txt` should say "Analysis is up to date" (a live head), not "unknown" / "Outdated"; (2) the page must NOT contain "Loading diffs…" and the "Checks N/2" must be 2/2, not 1/2; (3) cross-check a couple of cited line numbers against the actual diff at the pinned head. If any tell fires, RE-RUN devin-fetch.sh (a second capture minutes later; Devin finishes analyzing) and take the fresh one. On the re-run here the head-current capture reported "Analysis is up to date / Checks 2/2" and cited NEW line numbers (1657/1695) — genuine re-analysis of the fixed code, and it marked the Metal finding "Resolved".

**Fix / calibration:** This is the same class as the #825/#826 rule ("Devin's first capture after a push is the old rev and looks live — date it by CONTENT, not the page header"). For a re-review after a synchronize, treat the FIRST Devin capture as suspect-until-dated. A stale capture will re-flag exactly the gaps the push just closed, which would produce a spurious BLOCK on already-fixed code. Concretely: keep the fresh capture in a separate `review-fresh/` dir, compare, and synthesize from the head-current one.

**Second lesson (transferable):** A fix commit that closes your prior-round gaps does NOT mean the revision is now clean — verify the fixes AND re-challenge the new code. Here all three R1 gaps were genuinely fixed (device-owner check added to validateResourcePlacement, OOB test read fixed, Vulkan probe usage aligned + depth-stencil probe added), but the fix commit's new backend create-paths surfaced fresh questions (D3D12 placed-buffer init-data may copy without a COPY_DEST transition that the non-placed path sets; CUDA/D3D12 heap-kind edge cases) that only execution can settle — and CI never ran (fork PR, `action_required` awaiting maintainer approval → zero execution coverage). Net: ABSTAIN:OPEN_GAP again, same lane as R1 but for different, non-sticky reasons. An abstain that repeats across revisions should be re-derived from the new head, not carried forward.
