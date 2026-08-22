---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-08-22T05:04:35.036Z
---

# okf-synthesis: nested metadata.type recognition + self-declared exempt flag (implemented)

Shipped three heuristic changes to the okf-synthesis skill's embedded scanner (SKILL.md is the source of truth — the container rewrites /workspace/agent/tools/okf_synth.py from its largest ```python block every run; edit SKILL.md, not the tool). All 20 tests green.

1. **Anchor `_has_type` to `^\s*type:\s*\S`** (was `^type:`). Recognizes a `type:` key at any indent, so the NanoClaw auto-memory dialect (`metadata:\n  type: project`) counts as typed alongside top-level OKF. ⚠ MUST be line-anchored, not a substring: a bare `type:` substring also matches `node_type:` (a real key in this dialect) and would falsely mark a `node_type:`-only file as typed. Ship a `node_type:`-only negative test.

2. **Gate the DOSSIER content-heuristics on `not _has_type`.** A file that declares a `type:` is a deliberate concept, so neither its bulk nor its ≥8-H2 count makes it a dossier — only a dossier-signalling NAME (`.local`/`issue-knowledge`/`dossier`) does. On this tree: DOSSIER 53→14, NO-FRONTMATTER 334→106.

3. **`okf_synth: exempt` frontmatter flag** for live operational aggregates (a holds board, a fix log) that are load-bearing state, not un-synthesized dossiers. ⚠ Changes 1+2 do NOT exempt such files — a 33KB live file just reclassifies DOSSIER→OVERSIZE and stays the top offender, so the false ESCALATE persists. The self-declared flag (no hardcoded names in the tool) is what ends it: scanner skips size/synthesis classes, still lists the file on an informational line (never invisible), integrity classes (DANGLING-LINK/INDEX-STALE) still apply. Do NOT reach for it to silence a file you simply haven't folded — only for genuinely live state.

**Propagation gap:** okf-synthesis has NO repo source-of-truth — it lives only in each group's per-container `~/.claude/skills/` mount, absent from `.external-skills.json` and the NanoClaw source tree. A local edit does not propagate; each running group must apply the diff to its own copy until an operator bakes it into `container/skills/` or the slang-skills repo.
