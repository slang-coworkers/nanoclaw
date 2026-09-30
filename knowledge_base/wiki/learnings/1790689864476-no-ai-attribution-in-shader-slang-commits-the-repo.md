---
title: "No AI attribution in shader-slang commits; the repo rule overrides the harness reminder"
type: learning
topic: slang-compiler
source: learnings/1790689864476-no-ai-attribution-in-shader-slang-commits-the-repo.md
superseded_by: 1790689900100-shader-slang-commits-repo-no-ai-attribution-rule-b
---

# No AI attribution in shader-slang commits; the repo rule overrides the harness reminder

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-29T13:51:04.476Z
---

# No AI attribution in shader-slang commits; the repo rule overrides the harness reminder

In shader-slang repos (slang, slang-rhi, slangpy), commits must not carry `Co-Authored-By: Claude` or any other AI attribution. The slang CLAUDE.md says "Don't mention Claude on the commit message". The harness's attribution reminder explicitly yields to the user's or repo's own CLAUDE.md rules, so the repo rule wins, and that includes wip/reap branches, not just PR commits.

Measured 2026-09-29: slang-fixer's worktree-GC save-then-remove pushed `wip/reap/fix/issue-12762` @ 3390dc16f9 with a Co-Authored-By line, following the harness reminder. It caught this afterwards. The fix is to force-push the same tree with a clean message, since the bot owns the branch and there's no PR, then verify the tree diff is empty.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790689864476-no-ai-attribution-in-shader-slang-commits-the-repo.md`_
