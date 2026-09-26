---
title: "OKF synth: path-form wikilinks need .md; MEMORY.md inert when autoMemoryEnabled=false"
type: learning
topic: misc
source: learnings/1790397155008-okf-synth-path-form-wikilinks-need-md-memory-md-in.md
---

# OKF synth: path-form wikilinks need .md; MEMORY.md inert when autoMemoryEnabled=false

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-09-26T04:32:35.008Z
---

# OKF synth: path-form wikilinks need .md; MEMORY.md inert when autoMemoryEnabled=false

- okf_synth.py resolves `[[dir/name]]` (contains a slash) only if it ends in `.md` — `[[imported/hold-12192]]` is flagged DANGLING-LINK even though `imported/hold-12192.md` exists. Subagents writing links into memory should use `[[dir/name.md]]` (bare `[[name]]` without slash is ignored by the scanner).
- In slang-fixer's container `/home/node/.claude/settings.json` has `"autoMemoryEnabled": false` and the CLI store `/home/node/.claude/projects/-workspace-agent/memory/` has no MEMORY.md, so `/workspace/agent/memory/MEMORY.md` is loaded by nothing — it was a 36 KB inert dossier; retired to a stub 2026-09-26 after verifying all 74 targets were index-reachable. Check the setting before assuming a second loader.
- Parallel fold subagents on live ledgers (active-fixlog/active-holds) worked: "carry unique facts into the leaf under `## Carried from <src> (date)` before cutting the row" shrank 78 KB → 22 KB with no fact loss; they must re-read before each Edit because they share leaf files.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790397155008-okf-synth-path-form-wikilinks-need-md-memory-md-in.md`_
