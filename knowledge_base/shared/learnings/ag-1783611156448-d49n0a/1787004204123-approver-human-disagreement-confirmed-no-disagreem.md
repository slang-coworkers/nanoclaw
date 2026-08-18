---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-17T22:03:24.123Z
---

# [approver/human-disagreement] CONFIRMED (no disagreement): a PR adding a whole-repo sanitizer/analysis lane is red-on-arrival by nature — abstain citing the red lane matched the author self-closing it unmerged

**Context:** slangpy#1112 "Add cross-platform ThreadSanitizer workflow" (skallweitNV). Approver decided ABSTAIN_POLICY(OPEN_GAP) on all three revisions (R0 d97356a3, R1 0420ec66, R2 5fe5b70f), each citing the new TSan lane being red-on-arrival. Terminal outcome: **author self-closed the PR unmerged** (~90 min after opening, no maintainer rejection comment, no superseding PR cross-referenced). closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent human verdict (host auto-joins it).

**Calibration result — CONFIRMED, not a miss.** The abstain matched the outcome: the approver never rounded up to approve, and the human (the author) declined to merge. This is the "your call already matched the outcome" case worth recording as a positive control.

**The transferable class-signal (why this shape lands red):** A PR that introduces a NEW whole-repository sanitizer/analysis lane (TSan/ASan/UBSan/clang-tidy/coverage gate/new lint) almost always fails on its first real run — not because of a defect in the PR's own diff, but because the new instrument surfaces LATENT pre-existing issues scattered across untouched code (here: races in nanothread pool, texture_loader, profiler, plus a TSan-internal crash). The diff can be clean and the lane still red.

**How to probe it next time (sharpens Step-0 recall):**
- For a "add <analysis tool> workflow" PR, expect red-on-arrival and check the ACTUAL first run's findings: are they in the PR's touched files (→ the PR's own bug) or in pre-existing untouched code (→ surfaced-not-introduced)? Attribute every finding site.
- Then the real question for the human is the ROLLOUT STRATEGY, which the PR usually hasn't resolved: (a) fix all surfaced issues first, (b) ship a suppressions/ignore list, or (c) land the lane non-gating / allow-failure. Absence of any of these three is the concrete OPEN_GAP — name it as such.
- Such PRs commonly get withdrawn/reworked rather than merged as-is. An abstain citing "lane red-on-arrival + no rollout strategy" is well-calibrated for this class; do NOT feel pressure to approve a clean-looking diff whose new lane is red.

**Fix / rule:** New-analysis-lane PRs are a recognizable class whose safety hinges on rollout strategy, not diff cleanliness. Abstain(OPEN_GAP) naming the missing strategy is the calibrated call, and this case confirms it. Related: [[sanitizer lane revision fix flagged race yet stay red halt_on_error]], [[workflow_dispatch lane exercised but red-on-arrival]], [[submodule gitlink bump platform-scoped effect]].
