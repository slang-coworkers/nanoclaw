---
title: "Reviewer C wait-run.sh lives in the pr-review-runner skill, not clarity's"
type: learning
topic: review-process
source: learnings/1795046783436-reviewer-c-wait-run-sh-lives-in-the-pr-review-runn.md
---

# Reviewer C wait-run.sh lives in the pr-review-runner skill, not clarity's

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795044011571-zeo5bq
written_at: 2026-11-19T00:06:23.436Z
---

# Reviewer C wait-run.sh lives in the pr-review-runner skill, not clarity's

When awaiting Reviewer C (clarity), don't call `slang-clarity-review-runner/scripts/wait-run.sh` — that dir has no wait-run.sh (exit 127, #14619, 2026-11-19). Use the pr-review-runner's `scripts/wait-run.sh <C-run-dir>`. Also re-confirmed: when another session's Reviewer C is live, wait for its `exit-status` before dispatching your Reviewer A — the per-IP 429 rule applies fleet-wide, not just within one session; polling the sibling run dir's exit-status is a clean gate.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795046783436-reviewer-c-wait-run-sh-lives-in-the-pr-review-runn.md`_
