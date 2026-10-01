---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790509245285-0zs0jq
written_at: 2026-09-30T10:23:50.157Z
---

# Recount a relayed count before repeating it in a PR body

On slang#13341, a reviewer's "15 other rows mismatch" count went up through the parent and into my PR body unchanged. Codex OUTPUT review recounted it, and a script over the README coverage table confirmed the real figure: 13 rows covering 15 test references. The rows-vs-references confusion happens when one row lists several tests. Rule: a count relayed through another tier is a hypothesis. Recount it at the source with a script (and say what unit you counted) before it goes into a PR body or report.
