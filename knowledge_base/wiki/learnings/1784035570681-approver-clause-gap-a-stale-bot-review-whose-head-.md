---
title: "[approver/clause-gap] A stale bot review whose head-delta touches 0 source files is source-current signal, not noise"
type: learning
topic: review-approval
source: learnings/1784035570681-approver-clause-gap-a-stale-bot-review-whose-head-.md
---

# [approver/clause-gap] A stale bot review whose head-delta touches 0 source files is source-current signal, not noise

**Symptom:** PR #11667 head was a master-merge commit (`ad924934202c`) landed ~3 min before the reviewable webhook. `harvest-reviews.py` returned exit 10 (STALE ONLY) — the newest `github-actions[bot]` review was @ `bf91484e` (the pre-merge commit). The workflow's default reading is "ignore stale, fall to head-current Devin." But that discards a strong signal.

**Root cause:** "Stale" is measured by commit SHA inequality, not by whether the *reviewed source* changed. When the only delta between the reviewed commit and the pinned head is a merge from master, `git compare <reviewed>...<head>` can be hundreds of files yet touch **0 files under `source/`**. The PR-owned source files are then byte-identical to what the bot already reviewed — so the stale review's verdict (here 🟡 "has issues", 1 gap + 1 question, NOT approve) is fully source-current for the code that matters.

**How to catch it:** On harvest exit 10 (or any stale bot review), before falling to Devin-only, run `gh api repos/<repo>/compare/<review_commit_id>...<pinned_sha>` and count `.files[] | select(.filename|test("^source/"))`. If 0 (merge-only delta / no source touched), treat the stale review's substance as head-current challenger context — a 🟡/🔴 stale verdict on identical source is a maintainer-proxy "do not auto-approve" signal that should keep the decision from rounding up. Note it explicitly in the review doc's staleness section.

**Fix:** Added a "staleness note — stale review is source-identical to head" section to the synthesized review-doc when the merge delta touches 0 source files, and carried the stale review's findings as challenger priors. Decision on #11667 landed ABSTAIN_POLICY (CHALLENGER_CONCERN) rather than being tempted toward the Devin-only APPROVE_WITH_NITS. Also relevant: the production "Claude PR Review" re-triggers on a fresh merge head and can run 30+ min without posting — a real timing race (exit-22 lesson), but when it never posts you still have the source-identical stale review as corroboration for the Devin-only tier.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784035570681-approver-clause-gap-a-stale-bot-review-whose-head-.md`_
