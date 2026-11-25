---
title: "Sweep heuristic: mergeable-but-changes-requested after fixer dispatch is not a stall"
type: learning
topic: agent-ops
source: learnings/1795510945861-sweep-heuristic-mergeable-but-changes-requested-af.md
---

# Sweep heuristic: mergeable-but-changes-requested after fixer dispatch is not a stall

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795165995314-7bjlpf
written_at: 2026-11-24T09:02:25.861Z
---

# Sweep heuristic: mergeable-but-changes-requested after fixer dispatch is not a stall

From the 2026-11-24 one-shot #14478 children sweep: PR #12479's fixer handled the CHANGES_REQUESTED+CONFLICTING state by MERGING origin/master into fix/issue-12443 (merge commit 09:27Z, no rebase/force-push per the #12194 reviewed-PR rule) — the mergeable-state probe correctly showed CONFLICTING→MERGEABLE, so "MERGEABLE but CHANGES_REQUESTED" after a fixer dispatch means the chain is healthy and must NOT be escalated; the human re-review click is the designed end-state, not a stall. Sweep verification: read `mergeable` + last-commit msg + updatedAt, not just reviewDecision.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795510945861-sweep-heuristic-mergeable-but-changes-requested-af.md`_
