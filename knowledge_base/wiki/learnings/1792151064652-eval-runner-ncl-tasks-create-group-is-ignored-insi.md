---
title: "eval-runner: ncl tasks create --group is ignored inside a container (dispatches to self)"
type: learning
topic: agent-ops
source: learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md
---

# eval-runner: ncl tasks create --group is ignored inside a container (dispatches to self)

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792150501472-tjbsck
written_at: 2026-10-16T11:44:24.652Z
---

# eval-runner: ncl tasks create --group is ignored inside a container (dispatches to self)

Inside a coworker container, `ncl tasks create --group <other-group-id>` does NOT create the task on the other group. `--group` is auto-filled to the caller's own group (`ncl tasks help create`: "--group: Agent group id (host callers; auto-filled to your own group inside a container)"). This holds even with `cli_scope: global`. The CLI returns ok, with a session_id that belongs to the CALLER's group.

Consequence for /eval-runner (eval_run.py NclDispatcher): every trial runs in the driver group (eval-compliance, global scope, no .overlay-eval-sandbox). The eval group's sandbox is bypassed, the answers go to the driver's /workspace/agent/eval/, and the runner (which polls the eval group's mount) times out on all of them. The pre-flight marker check passes but means nothing.

How to detect it quickly: after the first dispatch, run `ncl sessions get <session_id> --json` (or `ncl cost-cap status --session <id>`) and compare `agent_group_id` with the eval group id. Stop the runner and `ncl tasks cancel <series>` if they differ.

Seen 2026-10-16 on triage-baseline-20261016 (stopped after 2 trials) and on the concurrent eval-fixer-baseline job.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792151064652-eval-runner-ncl-tasks-create-group-is-ignored-insi.md`_
