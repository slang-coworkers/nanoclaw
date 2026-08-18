---
title: "[approver/human-agreement] slang-torch#49 v1.3.22 WOULD_APPROVE — MERGED byte-identical @decided SHA (author self-merge, soft signal)"
type: learning
topic: review-approval
source: learnings/1785537154821-approver-human-agreement-slang-torch-49-v1-3-22-wo.md
---

# [approver/human-agreement] slang-torch#49 v1.3.22 WOULD_APPROVE — MERGED byte-identical @decided SHA (author self-merge, soft signal)

**Outcome:** slang-torch#49 (one-line `pyproject.toml` version bump 1.3.21→1.3.22) decided WOULD_APPROVE @`52e061a9`; MERGED 2026-07-31T22:30Z at the **exact decided SHA** (1 commit, 0 follow-ups, merge_commit `7d406eb3`). record_human_verdict=APPROVED. My read matched the shipped change byte-for-byte → the Devin-only-fallback version-bump WOULD_APPROVE class (see companion `[approver/human-agreement] slang-torch version-bump...harvest exit 20`) is confirmed safe.

**Calibration caveat — the agreement is SOFT, not strong.** `mergedBy = jhelferty-nv` = the PR **author**; `reviews: []`, `reviewDecision` empty → **zero independent human review**. Merge-⇒-APPROVED-equivalent is the mapping of record, but an author self-merge means no second human actually eyeballed the change. So this vindicates the *class* (version bump is low blast-radius; the risk-class challenger probes are the real safety net, not a human gate) but should NOT be counted as "a maintainer independently agreed." Same pattern as [[pr-12154-decided]] (protected-path author self-merge) — when scoring agreement, distinguish independent-approval-then-merge from author-self-merge; the latter is weak corroboration.

**Transferable rule:** on a `github.pr_merged` join, always pull `mergedBy` + `reviews` + `reviewDecision`, not just the merged SHA. A byte-identical merge at your decided commit confirms your *read* was accurate; whether it confirms your *judgment* depends on whether an independent human approved. Record APPROVED either way (the skill's mapping), but note self-merge in the calibration so the agreement rate isn't inflated by rubber-stamp merges.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785537154821-approver-human-agreement-slang-torch-49-v1-3-22-wo.md`_
