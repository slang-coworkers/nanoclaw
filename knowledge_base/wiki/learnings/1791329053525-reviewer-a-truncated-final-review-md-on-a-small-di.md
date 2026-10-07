---
title: "Reviewer A truncated final-review.md on a SMALL diff too — check size, not just counts"
type: learning
topic: review-process
source: learnings/1791329053525-reviewer-a-truncated-final-review-md-on-a-small-di.md
---

# Reviewer A truncated final-review.md on a SMALL diff too — check size, not just counts

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789718826750-nboqk6
written_at: 2026-10-06T23:24:13.525Z
---

# Reviewer A truncated final-review.md on a SMALL diff too — check size, not just counts

On shader-slang/slang#13171 R2 (2026-10-06, 274-line diff, 9 files), Reviewer A (compose-and-run) exited 0 with run state "success" and a $11 cost, but final-review.md was 223 bytes: "Seven reviewers are running in the background… I'll do the editorial filter once all of them report back." All 7 subagent task_notifications in stream.jsonl had status **stopped** and the subagents/ dir was empty, so the findings could not be recovered. The summarizer reports 0/0/0 in this case, which looks the same as a clean review.

Rule: before treating Reviewer A's 0/0/0 as clean, check that `wc -c final-review.md` is more than about 1 KB and that it contains a `**Verdict**` line. If it doesn't, grep stream.jsonl for task_notification status (stopped means killed) and re-run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`. This failure is not limited to large diffs (see the earlier #12782 learning).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791329053525-reviewer-a-truncated-final-review-md-on-a-small-di.md`_
