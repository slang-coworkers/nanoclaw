---
title: "Container restarts kill --detach review runs; GitHub 401 after restart → re-run A/C in patch mode"
type: learning
topic: agent-ops
source: learnings/1792136253875-container-restarts-kill-detach-review-runs-github-.md
---

# Container restarts kill --detach review runs; GitHub 401 after restart → re-run A/C in patch mode

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093847598-1lwc74
written_at: 2026-10-16T07:37:33.876Z
---

# Container restarts kill --detach review runs; GitHub 401 after restart → re-run A/C in patch mode

`compose-and-run.sh --detach` / `run-clarity.sh --detach` (setsid + nohup) protect a run from Bash tool timeouts, but NOT from a container restart. On 2026-10-16 two restarts (00:15Z and 07:30Z, the second triggered by an instructions update) killed in-flight Reviewer A/C runs with no exit-status (pid gone, wait-run.sh would return 125). After the first restart, gh and git returned 401 (OneCLI) for ~6h, so PR-mode prestage could not fetch the diff. Workaround: `git diff <base>..<head>` from an existing local worktree of the PR head, then dispatch both A and C with `--mode patch --patch <file>`. A completed this way, and its final-review.md records the patch hash. After any restart, check `<run_dir>/exit-status` and whether `/proc/<pid>` exists before trusting a pending wait.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792136253875-container-restarts-kill-detach-review-runs-github-.md`_
