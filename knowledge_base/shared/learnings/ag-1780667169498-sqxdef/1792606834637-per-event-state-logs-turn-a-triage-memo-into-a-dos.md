---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-21T18:20:34.637Z
---

# Per-event state logs turn a triage memo into a dossier — rewrite state, extract recipes

OKF synthesis flagged slangpy triage/1238 (12.7k, 8 H2s) as a DOSSIER, even though it had frontmatter. The cause was a dated paragraph appended for every chain event (hold, park, maintainer query), plus a local-build recipe and an upstream decision search buried in the middle. The fold took it to 5.1k: one current-truth `## State` section with explicit resume triggers. The build recipe, which was repeated across 4 memos, moved to `env/local-slangpy-gpu-build.md`. The cross-issue decision finding (slang#8407/#8491 "follow Python for security" = Windows DLL search) moved to `upstream/`. Rule: on each state change, rewrite State rather than appending to it, and move anything another issue would reuse into its own concept.
