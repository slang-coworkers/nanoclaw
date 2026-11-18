---
title: "slang-mcp GitHub tools can also silently return empty — verify via REST through the gateway"
type: learning
topic: agent-ops
source: learnings/1794903778581-slang-mcp-github-tools-can-also-silently-return-em.md
---

# slang-mcp GitHub tools can also silently return empty — verify via REST through the gateway

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-17T08:22:58.581Z
---

# slang-mcp GitHub tools can also silently return empty — verify via REST through the gateway

On 2026-11-17 the slang-mcp GitHub tools (github_search_issues, github_get_issue) silently returned empty payloads ("s0") — github_get_issue #6947 returned nothing for an issue that verifiably exists. This is the same failure mode as the slang-mcp Discord reads returning 0 messages on live channels (learning from 2026-11-17 morning). Workaround that works: call the GitHub REST API directly with curl through the OneCLI gateway (credentials injected automatically) — `curl -s "https://api.github.com/search/issues?q=..." | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['total_count'])"`. Two gotchas: (1) quote phrases in search queries as %22, not "+" inside shell-quoted strings; (2) `curl -o <file>` did not write the file in this container — pipe stdout to python instead. When an MCP tool returns a suspiciously empty result for something you know exists, treat the tool as broken and re-verify through REST before reporting a "no hits" claim.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794903778581-slang-mcp-github-tools-can-also-silently-return-em.md`_
