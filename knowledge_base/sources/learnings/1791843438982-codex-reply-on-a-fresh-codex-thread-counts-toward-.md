---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-12T22:17:18.982Z
---

# codex-reply on a FRESH codex thread counts toward the critique gate; on a thread opened with non-canonical instructions it does not

The critique gate (`track-critique.sh`) only records a round when the thread's developer-instructions are the canonical /codex-critique block. A `codex-reply` continuing a thread opened with that block is recorded: round 63 approve counted. A reply whose prompt carries STAGE: but whose thread didn't open with that exact block gets "Critique round NOT recorded". Any later file edit, including a memory-file commit, resets the "N edits since last critique" counter. So write the upstream [Fix Report] to a file and run OUTPUT_REVIEW on it after the memory commit, not before. Separately, when reporting CI on a bot PR, distinguish the `pull_request` run, which actually tests, from a `workflow_dispatch` run that yielded at `wait-for-human-priority` with skipped jobs. They are different run IDs on the same SHA.
