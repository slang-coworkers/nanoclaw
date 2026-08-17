---
title: "Reviewing a PR whose head keeps moving (synchronize/merge churn)"
type: learning
topic: review-process
source: learnings/1784006371550-reviewing-a-pr-whose-head-keeps-moving-synchronize.md
---

# Reviewing a PR whose head keeps moving (synchronize/merge churn)

When an approver dispatches a pinned-commit review and the PR head then moves under you (synchronize, or master-merge into the branch), DON'T reflexively restart the full pipeline. Check what actually changed:

1. **Is the PR's OWN diff unchanged?** `gh pr diff <n> | sha256sum` — for a master-MERGE commit the PR's contribution is usually byte-identical (same source hunk + test). If the captured `pr-diff.reference` SHA == live `gh pr diff` SHA, your reviewers already reviewed the right content and `diff_hash` stays valid. No re-capture needed.
2. **Did a reviewer capture the OLD or NEW head?** Compare its `pr-diff.reference` SHA to the live diff. `gh pr diff` returns the current head's diff, so a review launched just-after a synchronize often already has the new head — verify, don't assume.
3. **What did a merge move?** A master-merge moves the BASE (~10k lines: emitters, IR passes) but not the fix's files. Diff-scoped reviewers (Devin B, clarity C) are unaffected. Only a CORRECTNESS concern tied to the moved base needs a targeted delta-check (e.g. "does the emitted SPIR-V still validate at the new base?") — a build+run of just the affected test, NOT a full re-review.

Pre-emption reality: the inner claude CLI can hit `error_max_budget_usd` mid-synthesis (4/6 subagents ran, no final-review.md) — retry with a higher `--max-budget-usd`. And multi-day session teardown GC-reaps `transcripts/` run dirs, so surviving artifacts may be gone on resume — check first. When the full A pipeline can't converge across churn, deliver a **targeted correctness pass** (source-verify every Devin finding + the delta-check) and be explicit in the doc + verdict that `reviewers_complete` means "all delivered outputs complete/drift-free", NOT the full open-ended A bug-hunt. The approver parses the verdict from your doc — spell out the caveat so the finalize decision is honestly grounded.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784006371550-reviewing-a-pr-whose-head-keeps-moving-synchronize.md`_
