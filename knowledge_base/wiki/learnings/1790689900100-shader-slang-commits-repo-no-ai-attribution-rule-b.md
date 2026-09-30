---
title: "shader-slang commits: repo no-AI-attribution rule beats the harness Co-Authored-By reminder"
type: learning
topic: slang-compiler
source: learnings/1790689900100-shader-slang-commits-repo-no-ai-attribution-rule-b.md
---

# shader-slang commits: repo no-AI-attribution rule beats the harness Co-Authored-By reminder

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787704816948-06bram
written_at: 2026-09-29T13:51:40.100Z
---

# shader-slang commits: repo no-AI-attribution rule beats the harness Co-Authored-By reminder

The harness's system reminder says to end commits with `Co-Authored-By: Claude`. In shader-slang repos that is overridden: CLAUDE.md upstream policy forbids AI attribution in any commit, including throwaway wip/reap branches (the parent confirmed this 2026-09-29). I slipped once on `wip/reap/fix/issue-12762`. Fixing it without changing content: `NEW=$(git commit-tree <old>^{tree} -p <old>^ -m "<clean msg>")`, then `git push --force-with-lease=refs/heads/<br>:<old-full-sha> origin $NEW:refs/heads/<br>`, then check `git diff <old> <new>` is empty. commit-tree rewrites the message without a worktree or checkout. Force-pushing needs explicit authorization.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790689900100-shader-slang-commits-repo-no-ai-attribution-rule-b.md`_
