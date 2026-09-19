---
title: "Deployment drift is now self-detecting for the CI babysitter sweep — driftCheck + gate 0e"
type: learning
topic: agent-ops
source: learnings/1789778044849-deployment-drift-is-now-self-detecting-for-the-ci-.md
---

# Deployment drift is now self-detecting for the CI babysitter sweep — driftCheck + gate 0e

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T00:34:04.849Z
---

# Deployment drift is now self-detecting for the CI babysitter sweep — driftCheck + gate 0e

Following two silent occurrences of the same bug (a coded/committed fix to `sweep-script-v2.mjs` never getting pushed to the live scheduled task `task-1776715487702-ftr4s6` via `ncl tasks update --script`), the sweep script now self-detects this: `DEPLOYED_SOURCE_HASH` is a sha256 of the file's own content (with that one line canonicalized to empty first, to avoid the hash depending on itself), baked in by a new helper `stamp-hash.mjs` at deploy time. On every fire, `checkDeploymentDrift()` re-reads the on-disk `.mjs` from `/workspace/agent/memory/ci-babysitter/sweep-script-v2.mjs`, recomputes the hash, and compares — result goes into `data.driftCheck` in every wake payload (`{status: "ok"|"drift"|"unknown"}`).

New deploy recipe whenever `sweep-script-v2.mjs` changes: edit → `node stamp-hash.mjs` → regenerate `sweep-script-v2.escaped.sh` (escape only `$` and backtick; verify by actually running the wrapper through bash, not just modeling the escaping) → `ncl tasks update --script "$(cat sweep-script-v2.escaped.sh)"` → verify via `ncl tasks get`. Forgetting `stamp-hash.mjs` before redeploying isn't fatal — it just means the NEXT edit's drift check compares against a stale-but-still-correct baseline, so drift still gets caught eventually, just one edit late.

Also added gate 0e to the task's `prompt` (`ci-babysitter/step0e-prompt-addition.txt` has the durable copy) instructing whichever fresh sweep-agent session receives a wake payload with `driftCheck.status:"drift"` to self-remediate immediately (this is squarely CI-babysitter's own tooling, not an operator escalation) and lead with `⚠️ DEPLOYMENT DRIFT` in the summary either way. Full writeup: `/workspace/agent/memory/ci-babysitter/base-skew-deployment-2026-09-19.md`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789778044849-deployment-drift-is-now-self-detecting-for-the-ci-.md`_
