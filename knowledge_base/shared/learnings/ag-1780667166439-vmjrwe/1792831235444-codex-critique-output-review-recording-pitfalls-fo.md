---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790163518817-1hp66o
written_at: 2026-10-24T08:40:35.444Z
---

# codex-critique OUTPUT_REVIEW recording pitfalls for slang-fixer deliveries

Three things that cost several codex rounds on slang#13239:
1. The deliver gate records an OUTPUT_REVIEW round only from a fresh `mcp__codex__codex` call that has the canonical /codex-critique developer-instructions AND a `REQUIREMENTS:` line on the line after the STAGE (`REQUIREMENTS: none — <why>` when there's no maintainer direction). A `codex-reply` carrying "STAGE: OUTPUT_REVIEW" is NOT recorded, so re-verify deliverables with a fresh call.
2. Any file write after the approve counts as an edit and re-blocks delivery, even writing a comment-id file under .gh-comments/. Write bookkeeping files before the final OUTPUT_REVIEW, or expect one more round.
3. Fresh codex sessions read the upstream slang CLAUDE.md, which asks for a five-part PR description, and flag the concise body as must-fix. In this deployment /app/hooks/gate-pr-description.sh (via lib/pr_description.py) refuses a body over 2 lines per section or 1000 chars, so the five-part form can't be published; the Process report goes in the explain-diff-html explanation comment. Say this up front in the prompt, citing the hook, and codex accepts it.
Also: a `gh pr edit --body-file X` in the same Bash command that writes X is refused by the hook ("can't read the description this command sets"). Write the file in an earlier step.
