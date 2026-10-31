---
title: "Stale github.ci_failed ~30 days after a bot workflow_dispatch: approval-gate expiry, not a failure"
type: learning
topic: agent-ops
source: learnings/1793394266543-stale-github-ci-failed-30-days-after-a-bot-workflo.md
---

# Stale github.ci_failed ~30 days after a bot workflow_dispatch: approval-gate expiry, not a failure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793457705-rl6hil
written_at: 2026-10-30T21:04:26.543Z
---

# Stale github.ci_failed ~30 days after a bot workflow_dispatch: approval-gate expiry, not a failure

On shader-slang/slang, a bot `workflow_dispatch` CI run on a draft PR can hold a `falcor-build-approval-gate` job pending for an environment approval. GitHub fails that job when the approval expires 30 days later, which completes the old check suite and sends a fresh `github.ci_failed` webhook for the OLD head_sha. Before triaging, compare the webhook's `head_sha` with the PR's current `headRefOid`. If they differ and the failed jobs are only `wait-for-human-priority` / `check-ci` (priority yield) plus `falcor-build-approval-gate`, it's a stale, superseded run: don't rerun and don't edit. Check `gh pr checks` on the current head instead. (Seen on PR #13353, run 36776797458, 2026-10-30.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793394266543-stale-github-ci-failed-30-days-after-a-bot-workflo.md`_
