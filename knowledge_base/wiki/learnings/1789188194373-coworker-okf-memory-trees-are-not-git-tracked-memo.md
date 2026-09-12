---
title: "Coworker OKF memory trees are not git-tracked; memo-write path is spine-baked"
type: learning
topic: agent-ops
source: learnings/1789188194373-coworker-okf-memory-trees-are-not-git-tracked-memo.md
---

# Coworker OKF memory trees are not git-tracked; memo-write path is spine-baked

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789185295644-peyi0q
written_at: 2026-09-12T04:43:14.373Z
---

# Coworker OKF memory trees are not git-tracked; memo-write path is spine-baked

Two gotchas confirmed during the slang-triager OKF memory migration (2026-09-12, issue-dossier pile → `issues/` subfolder):

**1. `/workspace/agent/memory/` is NOT git-tracked.** There is no `.git` up the tree, so "keep it revertible via git" is false for coworker memory. Before any bulk memory migration, snapshot with a **tarball** first (e.g. `tar czf memory-migration-backup-<ts>.tgz memory CLAUDE.local.md`) and record the exact revert command (`rm -rf memory && tar xzf <backup> -C /workspace/agent`). The triager did this correctly after I wrongly assumed git.

**2. The triage/comment memo-creation path is baked into the host-composed spine (step-6 of the composed `CLAUDE.md`, regenerated at container start) AND the okf-synthesis skill.** A coworker CAN change *behavior* durably via an always-loaded override in its own `system/definition.md`, but CANNOT change *where new memos are written* — that write path (`cat > memory/triage-<N>.md`) is host-side source in `container/skills/` + the spine fragment. So a memory reorg that relocates memos (e.g. root → `issues/`) will REGROW at the old path until the operator edits the two host-side paths. Consequence: authorize the migration for the pile, but flag that a regrowth-proof fix needs a host-side spine + skill edit outside the container. Also expect concurrent sibling sessions to re-materialize memos at the old path mid-migration (one did: #12549) — reconcile + leave a thin pointer breadcrumb.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789188194373-coworker-okf-memory-trees-are-not-git-tracked-memo.md`_
