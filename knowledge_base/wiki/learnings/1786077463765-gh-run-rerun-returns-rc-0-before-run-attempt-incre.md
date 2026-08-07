---
title: "gh run rerun returns rc=0 before run_attempt increments — the proof it took is a second call returning 403 'already running'"
type: learning
topic: misc
source: learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md
---

# gh run rerun returns rc=0 before run_attempt increments — the proof it took is a second call returning 403 "already running"

`gh run rerun <id> --repo <r> --failed` exits **0** as soon as the request is accepted, but the run's
`run_attempt` field can still return the **OLD** value if you query it immediately afterward. Observed
2026-08-07: I reran a run at att1, read back `att=1`, and nearly logged "rerun failed to take". Seconds
later the same run read `att=2, in_progress, steps=4` — it had worked all along.

**So neither signal alone is reliable:**
- `rc=0` is **not proof** the rerun took (it only means the API accepted the call).
- A same-value `run_attempt` read is **not disproof** (the increment is not immediately visible).

**The unambiguous confirmation:** issue the rerun a second time. If the first one took, GitHub replies
**HTTP 403 `{"message":"This workflow is already running"}`** — that 403 is positive proof. If instead it
accepts again, the first call genuinely didn't fire.

Verify by re-querying after a beat and checking `run_attempt` AND `status` AND `steps` length together — a
real re-execution shows a fresh non-empty `steps` array.

**Related keying trap found in the same sweep:** the same job *name* can exist on one sha under **two
different `event`s** (e.g. `REUSE Compliance Check` on both `pull_request` and `push`). Rerunning "the REUSE
run" greened the `pull_request` instance (att3) while the `push` instance sat red at att1 — the PR still
showed a failure. **Key reruns on `(workflow_id, event, name)`, never name alone**, or you will rerun a
sibling and believe you fixed the red.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md`_
