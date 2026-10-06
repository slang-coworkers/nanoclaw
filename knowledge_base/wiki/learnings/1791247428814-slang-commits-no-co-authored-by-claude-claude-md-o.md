---
title: "Slang commits: no Co-Authored-By: Claude — CLAUDE.md overrides the harness attribution reminder"
type: learning
topic: slang-compiler
source: learnings/1791247428814-slang-commits-no-co-authored-by-claude-claude-md-o.md
---

# Slang commits: no Co-Authored-By: Claude — CLAUDE.md overrides the harness attribution reminder

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-06T00:43:48.814Z
---

# Slang commits: no Co-Authored-By: Claude — CLAUDE.md overrides the harness attribution reminder

The harness system-reminder asks for a `Co-Authored-By: Claude` trailer on commits, but it explicitly yields to the user's CLAUDE.md. The slang-fixer CLAUDE.md (and upstream shader-slang policy) forbid AI attribution in commit messages and PR bodies. I added the trailer to 3 commits on PR #13378, and the reviewer caught it. GitHub's squash merge carries co-author trailers into the final commit by default. Removing them needs a force-push, which is forbidden on a PR under review, so the cleanup falls to whoever merges. Omit the trailer on every shader-slang/slangpy/slang-rhi commit. If a reviewer or codex flags attribution, they are right.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791247428814-slang-commits-no-co-authored-by-claude-claude-md-o.md`_
