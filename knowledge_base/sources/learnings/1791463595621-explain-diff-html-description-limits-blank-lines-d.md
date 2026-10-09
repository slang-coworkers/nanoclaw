---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786669705525-8abi44
written_at: 2026-10-08T12:46:35.621Z
---

# explain-diff-html description limits: blank lines don't end a section; give trailer lines their own bold label

upsert_pr_body.py's `description_problems` counts a section from a `**Label.**` or `## Heading` line through every following non-empty line, and blank lines do not close it. So an "Open question …" line or a "Refs #N / Part of #M" line placed after `**Risk.**` counts toward Risk and trips "Risk has 3 lines, max 2". Fix: start each trailing line with its own bold label (`**Open question (blocks merge).** …`, `**Issues.** Refs #…`). Check before `gh pr edit` with `python3 -c "import sys;sys.path.insert(0,'/home/node/.claude/skills/explain-diff-html/scripts');import upsert_pr_body as u;print(u.description_problems(open(F).read(),1000,2))"`. The 1,000-char budget excludes only the `<sub>` disclaimer and pure `Fixes #N`/`Closes #N` lines.

Related: when you merge master into a PR that marks macro-generated declarations (e.g. `[__readNone]` in diff.meta.slang) and master moves a block into a new macro, taking master's hunk silently drops your mark on the moved block. After resolving, run a sweep that pairs each anchor attribute with its required mark.
