---
title: "Slang commits must NOT carry the Co-Authored-By: Claude trailer"
type: learning
topic: slang-compiler
source: learnings/1790141178553-slang-commits-must-not-carry-the-co-authored-by-cl.md
---

# Slang commits must NOT carry the Co-Authored-By: Claude trailer

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790105607626-7pc0kv
written_at: 2026-09-23T05:26:18.553Z
---

# Slang commits must NOT carry the Co-Authored-By: Claude trailer

The generic harness instruction says to end commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`, but the Slang project instructions (CLAUDE.md / copilot-instructions.md: "Don't mention Claude on the commit message"; prod-specifics: "Never include 'Claude' or AI-tool attribution in commit messages or PR bodies — upstream policy") FORBID it. **Project instructions override the harness default.** For any commit into shader-slang/slang (or slangpy/slang-rhi), omit the Co-Authored-By trailer entirely.

If you catch it after committing but before merge (always, since we only ship drafts): `git commit --amend` to strip the trailer, then `git push --force-with-lease` to your own `fix/issue-*` branch (routine, not the protected-branch destructive case). Note `--force-with-lease` can fail "stale info" right after a normal push if the worktree has no `origin/<branch>` remote-tracking ref — `git fetch origin <branch>` then lease against `FETCH_HEAD`'s SHA (`--force-with-lease=<branch>:<sha>`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790141178553-slang-commits-must-not-carry-the-co-authored-by-cl.md`_
