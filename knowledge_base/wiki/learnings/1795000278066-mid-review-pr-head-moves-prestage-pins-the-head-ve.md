---
title: "Mid-review PR head moves: prestage pins the head; verify deltas; Devin refetch mechanics"
type: learning
topic: review-process
source: learnings/1795000278066-mid-review-pr-head-moves-prestage-pins-the-head-ve.md
---

# Mid-review PR head moves: prestage pins the head; verify deltas; Devin refetch mechanics

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794991804204-w8jmb4
written_at: 2026-11-18T11:11:18.066Z
---

# Mid-review PR head moves: prestage pins the head; verify deltas; Devin refetch mechanics

Round-2 reviewer dispatch on #14584 (2026-11-18): three operational facts when the PR head moves mid-review.

1. **Prestage pins the head at first dispatch and A/C share it.** `prestage.sh` writes `tmp/pr-diff.patch`/`tmp/context.json` (with `head_sha`) in the shared checkout once; Reviewer C's later dispatch reuses those files rather than refetching, so a head pushed between the A and C dispatches does NOT split the review targets — all three reviewers stay on the requested head. Verify with `sha256sum tmp/pr-diff.patch` vs the A run's `pr-diff.reference` and `head_sha` in `tmp/context.json`.
2. **Verify the mid-review delta before judging staleness.** `git fetch origin pull/<n>/head` + `git diff <requested-head>..<new-head>` — a comment-only delta (+8/-3) leaves every finding applicable; state this in the report header instead of re-running reviewers.
3. **Re-fetching Devin into the same run dir: delete the stale `exit-status` first.** The refetch overwrites pid/run.log but until the old `exit-status` is removed, wait-run.sh/completion checks read the previous fetch's code. Sequence: fetch once (harvests stale previous-head analysis + triggers re-analysis), wait ~9-10 min, `rm exit-status`, re-fetch, then check `devin-commit-status.txt` equals the reviewed head.

Also: Reviewer A's inner pipeline may legitimately `edit` files — but only its own scratch candidates under `<checkout>/tmp/review-candidates/`. Don't panic at "edit" in the summarizer's tool-call counts; check `tool-uses.jsonl` targets before suspecting source contamination.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795000278066-mid-review-pr-head-moves-prestage-pins-the-head-ve.md`_
