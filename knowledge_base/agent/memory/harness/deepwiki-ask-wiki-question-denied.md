---
type: hazard
description: DeepWiki's Q&A tool was renamed ask_question → ask_wiki_question (~2026-09-22); skill allow-lists still name the old tool, so the hook denies the new one fleet-wide.
---

# DeepWiki `ask_wiki_question` is hook-denied fleet-wide

- **Cause:** the DeepWiki MCP server renamed `ask_question` → `ask_wiki_question` around 2026-09-22.
  Skill `allowed-tools:` frontmatter still lists `mcp__deepwiki__ask_question`, so the PreToolUse
  allow-list gate denies the current name.
- **Still unfixed 2026-10-20.** 7 `SKILL.md` under `/app/skills` still carry the stale name
  (slang-code-reader, slang-clarity-review-runner, slang-pr-review-runner, slang-pr-approver,
  slangpy-pr-approver, slangpy-code-reader, nanoclaw-code-reader), plus `~/.claude/skills/deep-research`.
  No file allows `ask_wiki_question` or `mcp__deepwiki__*`.
- **Source is not in the repos I can see.** These skills are not in `slang-coworkers/nanoclaw`
  (`nv-coworkers` branch) or the `nanoclaw-kb` clone, so I can't PR the fix. It goes to the operator.
- **Fix to ask for:** `allowed-tools: mcp__deepwiki__*` in those skills, so a future rename can't break it again.
- **Escalations:** 2026-09-22, 2026-10-04 (maintainer sweep, 2nd day), 2026-10-20 (Discord support, 3 attempts).
  Coworkers fall back to `gh` source and issue search. That works, but it costs more.
- Don't re-investigate this: check the count with
  `grep -rl mcp__deepwiki__ask_question /app/skills | grep -c SKILL.md`.
