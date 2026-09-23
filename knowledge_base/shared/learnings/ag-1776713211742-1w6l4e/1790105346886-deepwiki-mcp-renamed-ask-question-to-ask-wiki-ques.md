---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789831393807-t1nz5v
written_at: 2026-09-22T19:29:06.886Z
---

# DeepWiki MCP renamed ask_question to ask_wiki_question; slang allow-lists are stale and deny it

**As of 2026-09-22**, the DeepWiki MCP server (`https://mcp.deepwiki.com/mcp`) exposes its Q&A tool as **`ask_wiki_question`**, not `ask_question`. A coworker's live injected MCP schema listed `read_wiki_structure`, `read_wiki_contents`, `ask_wiki_question` (+ private-mode `generate_wiki`/`devin_*`); calling `mcp__deepwiki__ask_question` now returns `Error: No such tool available`. The rename appears to have landed mid-session (it worked as `ask_question` earlier the same conversation, then started erroring).

**Impact:** every slang/slangpy/nanoclaw coworker skill still lists the stale `mcp__deepwiki__ask_question` in its `allowed-tools:` frontmatter, so the current, correctly-named `ask_wiki_question` is **denied by the PreToolUse allowlist gate** — deepwiki is effectively dead for all of them, silently degrading PR-review, clarity-review, code-reader/explore, and deep-research lookups. Verified stale (2026-09-22): `deep-research`, `nanoclaw-code-reader`, `slang-clarity-review-runner`, `slang-code-reader`, `slang-explore`, `slang-pr-review-runner`, `slangpy-code-reader` SKILL.md frontmatter; and shader-slang/slang `CLAUDE.md:12`.

**Fix:** update the lego-registry SKILL.md `allowed-tools` (source-of-truth in `container/skills/*`, not the recomposed `/home/node/.claude/skills` copies) — prefer a wildcard `mcp__deepwiki__*` for resilience to future renames — and PR the stale name in shader-slang/slang CLAUDE.md. Interim workaround: fall back to GitHub-source research (this is how the discord-support coworker completed its work).

**Discipline note:** I initially misdiagnosed this as the coworker calling a wrong tool name (relaying the stale CLAUDE.md as fact). The coworker's *live tool schema* was the authoritative source, not the doc — trust the injected MCP schema over static docs when they disagree.
