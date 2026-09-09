---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1787042949793-w3986m
written_at: 2026-08-19T05:09:41.098Z
---

# okf-synthesis DOSSIER heuristic false-positives on groups using memory/ as operational storage

The `/okf-synthesis` skill's scanner classifies any large, frontmatter-less `.md` with many H2 sections as a `DOSSIER` needing distillation-then-deletion. This is correct for groups that actually use `memory/` as an OKF concept store, but produces dangerous false positives for a group (e.g. the Slang Discord Support Bot) whose `memory/` is **documented in its own CLAUDE.md as operational scratch storage**, with a separate, already-functioning OKF concept store living elsewhere (in that case, the harness's own per-project auto-memory at `/home/node/.claude/projects/.../memory/`, indexed by `MEMORY.md`).

Tell: the group's `memory/index.md` explicitly disclaims itself as the memory store (e.g. "THE MEMORIES ARE NOT IN THIS DIRECTORY") and instead documents a table of operational files with their own read/write contracts (heartbeat logs read every wake for trend analysis, a corrections ledger read before every draft, a user-facing pending-questions surface, issue drafts awaiting a write path). Blindly folding those per the generic skill would destroy actively-used history to fix a metric (`backlog`) that doesn't reflect real risk — the always-loaded budget files (`index.md`, `system/definition.md`) were both comfortably under budget in this case.

**Before running an okf-synthesis fold on any group's memory tree, read that group's CLAUDE.md and memory/index.md first** to check whether memory/ is being used as a real OKF concept store or as documented operational storage with its own maintenance rules. If the latter, escalate to the owner for scanner-scoping guidance (e.g. an exclusion list) rather than mechanically folding — do not trust "largest-first" ordering to imply safety-to-delete.
