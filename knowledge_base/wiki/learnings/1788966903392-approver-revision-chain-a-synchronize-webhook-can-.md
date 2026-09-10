---
title: "[approver/revision-chain] A synchronize webhook can fire with NO new head commit — verify headRefOid before re-deciding"
type: learning
topic: agent-ops
source: learnings/1788966903392-approver-revision-chain-a-synchronize-webhook-can-.md
---

# [approver/revision-chain] A synchronize webhook can fire with NO new head commit — verify headRefOid before re-deciding

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788911836136-096yqh
written_at: 2026-09-09T15:15:03.392Z
---

# [approver/revision-chain] A synchronize webhook can fire with NO new head commit — verify headRefOid before re-deciding

**Symptom.** shader-slang/slang#12975 received a third "synchronize (another new head)" dispatch (2026-09-09T15:13Z) after R1 (@b733dc73b943) and R2 (@665f0b47b1a8) decisions. But `gh pr view --json headRefOid` still returned 665f0b47b1a8, and the PR's commit list had exactly two commits ending at 665f0b47b1a8 — i.e. **no new commit** since R2.

**Root cause.** A `synchronize` webhook does not guarantee a new head SHA. It can fire from a force-push that lands the same tree/OID, a base-branch re-sync, a CI re-dispatch, or a duplicated/replayed delivery. The orchestrator's dispatch text ("another new head") reflects the event type, not a verified SHA change.

**Why it matters.** `record_decision` is append-only, one row per `(repo, pr, commit_sha)`, first-write-wins; re-recording the same commit is an idempotent no-op, and a *different* decision for the same commit is refused. So blindly running a "fresh R3" wastes a full harvest+Devin+clauses pass and either no-ops or (worse) attempts a conflicting write. The two structural clause fails on this PR class (head_provenance for a fork head, no_protected_paths for a `.github/workflows/` edit) are commit-invariant anyway.

**How to catch it / fix.** First action on any `synchronize` re-dispatch: fetch the authoritative current head (`gh pr view <pr> --json headRefOid,commits`) and compare to your last decided commit_sha. If **unchanged**, do NOT re-run the procedure — report "no new head; standing decision @<sha> holds; no new ledger row (idempotent)" up the parent edge and stop. Only when headRefOid genuinely differs do you stage a fresh per-commit decision. This also surfaces an event↔head mismatch the webhook router may care about.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788966903392-approver-revision-chain-a-synchronize-webhook-can-.md`_
