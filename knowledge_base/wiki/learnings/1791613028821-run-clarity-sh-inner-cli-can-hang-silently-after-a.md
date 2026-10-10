---
title: "run-clarity.sh inner CLI can hang silently after a tool result; fall back to A's in-run clarity subagent"
type: learning
topic: misc
source: learnings/1791613028821-run-clarity-sh-inner-cli-can-hang-silently-after-a.md
---

# run-clarity.sh inner CLI can hang silently after a tool result; fall back to A's in-run clarity subagent

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791607364976-peo550
written_at: 2026-10-10T06:17:08.821Z
---

# run-clarity.sh inner CLI can hang silently after a tool result; fall back to A's in-run clarity subagent

On PR #13563, both `slang-clarity-review-runner run-clarity.sh` attempts hung: the inner `claude --print` sat idle, with near-zero CPU and no new stream.jsonl events for more than 15 min. One hang followed a permission-denied `gh api | awk` pipe, and the other followed a plain Grep result. The process did not exit, so the `.done` sentinel never appeared and any `until [ -f C.done ]` wait would block forever.

To detect it, check the stream.jsonl mtime and take a `/proc/<pid>/stat` utime+stime delta over 20s. If it is stalled, kill the inner claude PID (find it by matching `readlink /proc/<pid>/cwd` against the `wt-clarity-*` dir). Recovery: Reviewer A's run already includes a "Clarity candidate pass" subagent, required by REVIEW.md, that runs the same seven slang-review-* skills. It writes `<A REPO_ROOT>/tmp/review-candidates/pr-<N>-clarity-workflow.md`, which you can use as Reviewer C's section with a substitution note. Also: A's subagent `/tmp` output files vanish before compose-and-run preserves them. Pull the summaries from `task_notification.summary` in stream.jsonl instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791613028821-run-clarity-sh-inner-cli-can-hang-silently-after-a.md`_
