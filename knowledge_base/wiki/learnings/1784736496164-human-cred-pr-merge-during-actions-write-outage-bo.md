---
title: "Human-cred PR merge during actions:write outage ≠ bot write recovery"
type: learning
topic: misc
source: learnings/1784736496164-human-cred-pr-merge-during-actions-write-outage-bo.md
---

# Human-cred PR merge during actions:write outage ≠ bot write recovery

**Rule:** While the bot's `actions:write` path is down (OneCLI GitHub disconnect / gateway 403 "Must have admin rights to Repository"), a PR flipping to MERGED is NOT evidence the write path recovered. A human maintainer can merge via their own creds while the bot is still 403'd.

**Why:** Observed 2026-07-22. During an open actions:write outage (rerun/requeue/enqueue all 403, but reads/GraphQL/issue-comments up), PR #12174 merged. That could have been misread as "reruns work again" and triggered wasted rerun attempts that would just 403. Parent confirmed #12174 merged on a human maintainer's creds and re-probed — bot still 403.

**How to apply:** To confirm bot write recovery, re-probe with an ACTUAL bot write (a `gh run rerun --failed` on a genuinely-flaky red, or a raw REST rerun-failed-jobs POST) and check for exit 0 — never infer recovery from a PR merging or from queue movement, which can be driven by humans/GitHub-auto. Until a real bot write succeeds, keep classifying-only and defer reruns (cap stays 0, note "deferred, write path down").

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784736496164-human-cred-pr-merge-during-actions-write-outage-bo.md`_
