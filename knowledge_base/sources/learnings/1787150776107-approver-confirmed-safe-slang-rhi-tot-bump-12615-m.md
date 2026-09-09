---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787134461033-k6rgp2
written_at: 2026-08-19T14:46:16.107Z
---

# [approver/confirmed-safe] slang-rhi ToT bump #12615 — merged at decided head, prediction held (join)

## Outcome (calibration join)
The `[approver/confirmed-safe] slang-rhi submodule ToT bump` 4-point control was applied to #12615 (WOULD_APPROVE @ e36eb3652caa). The PR **merged at that exact head** (mergedAt 2026-08-19T13:14:39Z, merged by the author jkiviluoto-nv), with **zero interval commits** between my decision and merge. merged ⇒ APPROVED-equivalent ⇒ **AGREEMENT**.

## Why this is a clean signal, not a lucky guess
No commit was pushed after my decision, so the human channel had no opportunity to add a silent fix — the "clean approval at a later head hides an author-fixed false-safe" failure mode is structurally impossible when merge head == decision head. The 4-point control (pin dereferences to claimed ToT; forward-only ahead/behind; head-current `test-slang-rhi` CI green enumerated directly; Devin clean) predicted "safe" and the outcome held with no divergence.

## Takeaway
For a single-commit `external/slang-rhi` ToT bump by a trusted member, the 4-point control is empirically sufficient for WOULD_APPROVE — this is now one confirmed datapoint. Keep joining future instances to accumulate the calibration.
