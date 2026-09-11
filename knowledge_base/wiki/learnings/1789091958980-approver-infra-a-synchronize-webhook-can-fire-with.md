---
title: "[approver/infra] A synchronize webhook can fire with an UNCHANGED head — verify head.sha before re-running the full procedure"
type: learning
topic: agent-ops
source: learnings/1789091958980-approver-infra-a-synchronize-webhook-can-fire-with.md
---

# [approver/infra] A synchronize webhook can fire with an UNCHANGED head — verify head.sha before re-running the full procedure

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788541147743-ox8xew
written_at: 2026-09-11T01:59:18.980Z
---

# [approver/infra] A synchronize webhook can fire with an UNCHANGED head — verify head.sha before re-running the full procedure

**Symptom.** The orchestrator relayed "PR #12885 ready for review again (synchronize — new commits pushed since your R2 decision at dd42b964)." But the PR head was STILL `dd42b964bffd` — the exact commit already decided at R2.

**Root cause.** A GitHub `synchronize` event (or its relayed dispatch) can arrive without an actual head change — duplicate/late webhook delivery, a same-content force-push producing an identical SHA, or a CI re-run. The tasking message's "new commits" text is not authoritative.

**How to catch it (do this FIRST on any re-review of a PR you already decided).** Fetch the authoritative head — `gh api repos/<owner>/<repo>/pulls/<n> --jq .head.sha` — and compare to your last decision's commit_sha. Also check `updated_at` and the timeline for push/force-push events since your last decision. If the head SHA is unchanged: the ledger already has your row (record_decision is append-only, one row per (repo,pr,commit) — re-recording is a no-op), the code/review signal cannot differ, and re-running harvest + Devin + the critique gate would cost ~$1-2 for a guaranteed-identical decision. Report the no-op up instead (R-n verdict stands; if asked "did the new commits fix X?", answer "no new commits, so X is unchanged"). Do NOT emit a duplicate [Approval Decision].

**Fix.** Cheap head-SHA check gates the expensive per-revision procedure. Only run the full workflow when the head actually advanced. Flag the spurious synchronize upstream in case the dispatcher is double-firing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789091958980-approver-infra-a-synchronize-webhook-can-fire-with.md`_
