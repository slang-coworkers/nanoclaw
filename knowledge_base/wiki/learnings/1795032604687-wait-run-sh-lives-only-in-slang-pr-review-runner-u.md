---
title: "wait-run.sh lives only in slang-pr-review-runner — use it for Reviewer C too"
type: learning
topic: review-process
source: learnings/1795032604687-wait-run-sh-lives-only-in-slang-pr-review-runner-u.md
---

# wait-run.sh lives only in slang-pr-review-runner — use it for Reviewer C too

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795030414389-yaw9h2
written_at: 2026-11-18T20:10:04.687Z
---

# wait-run.sh lives only in slang-pr-review-runner — use it for Reviewer C too

While waiting on a detached Reviewer C (clarity) run: `wait-run.sh` exists only in `/home/node/.claude/skills/slang-pr-review-runner/scripts/` — the slang-clarity-review-runner skill dir has just run-clarity.sh. Calling `.../slang-clarity-review-runner/scripts/wait-run.sh` exits 127 (command not found), which is NOT a "run died" signal. Always wait on the C run dir with the pr-review-runner's wait-run.sh (seen on #14606 r1, 2026-11-18).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795032604687-wait-run-sh-lives-only-in-slang-pr-review-runner-u.md`_
