---
title: "[approver/human-agreement] ABSTAIN(OPEN_GAP) on a maintainer-flagged design fork, then MERGED at your exact head with a formal Approve = clean withhold resolution (fork decided by humans), NOT a false-safe"
type: learning
topic: review-approval
source: learnings/1784756558331-approver-human-agreement-abstain-open-gap-on-a-mai.md
---

# [approver/human-agreement] ABSTAIN(OPEN_GAP) on a maintainer-flagged design fork, then MERGED at your exact head with a formal Approve = clean withhold resolution (fork decided by humans), NOT a false-safe

**Symptom:** PR #12151 (shader-slang/slang, public-by-default struct members, Slang 2026) was withheld ABSTAIN_POLICY/OPEN_GAP across R1→R3 on an empirically-confirmed E30604 `UseOfLessVisibleType` behavior: a 2026 `public struct` with a less-visible field type hard-errors (2025-valid code breaks at 2026). The design fork — (a) intended hygiene, keep the error vs (b) cap member visibility at field-type visibility — was posed by the fixer and left open by the maintainers. Then the PR MERGED.

**Outcome / how it resolved:** Merged head = `049dac19cd73`, my **exact operative R3 commit** — nothing landed after R3, so the E30604 behavior shipped as-is (no cap, no pinning test, no migration note). jkwak-work issued a **formal APPROVED at that exact commit** (after my R3 decision) and merged; the author is nv-slang-bot, so this is a genuine maintainer approval, **not a self-merge**. `reviewDecision=APPROVED`. Recorded human_verdict=APPROVED against the R3 row.

**Calibration read (the lesson):** This is the textbook "human must look" resolution the shadow ABSTAIN exists to produce, and it is **NOT a false-safe**: a false-safe is WOULD_APPROVE where the human found a real defect. Here I never claimed a defect — I explicitly classified E30604 as intended/opt-in/fail-safe behavior whose desirability was an open *design* question, and withheld precisely so a human would decide the fork. The human decided **fork (a): the error is correct hygiene**, and shipped. ABSTAIN→APPROVED on an intended-but-undecided behavior = **agreement / clean withhold resolution**, the same class as "ABSTAIN on protected-path → byte-identical merge with approval."

**How to apply:** When scoring the merge join of an OPEN_GAP that rested on an *intended-but-design-undecided* behavior (not a claimed bug): merged-at-your-head-with-a-formal-Approve is vindication, not a miss — the fork was resolved in favor of "as-is." Record APPROVED and note the fork resolution; do NOT log it as false-safe or human-disagreement. Reserve false-safe strictly for WOULD_APPROVE-over-a-real-defect. Also confirms the standing rule paid off: **verify the join SHA first** — here the merged head equaled the recorded head (single-commit PR, no post-decision push), so the verdict attaches cleanly to R3; had a cap/test landed after R3 it would have superseded the row instead.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784756558331-approver-human-agreement-abstain-open-gap-on-a-mai.md`_
