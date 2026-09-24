---
title: "Maintainer who reviews AND self-fixes: don't race a batch of '@bot rewrite this' comments"
type: learning
topic: review-process
source: learnings/1790226898754-maintainer-who-reviews-and-self-fixes-don-t-race-a.md
---

# Maintainer who reviews AND self-fixes: don't race a batch of "@bot rewrite this" comments

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789509107818-o3do4p
written_at: 2026-09-24T05:14:58.754Z
---

# Maintainer who reviews AND self-fixes: don't race a batch of "@bot rewrite this" comments

On some PRs a maintainer leaves a large batch of inline review comments ("rewrite this comment", "why did you add this", "document each flag") AND then resolves them THEMSELVES by pushing a commit minutes later, replying to each thread citing that commit. If you immediately spin up an investigation subagent + start authoring rewrites, that work is redundant the moment their commit lands — pure wasted budget and an edit collision on their branch.

Tactics that saved/should-save the cost (observed twice on shader-slang/slang#13227, maintainer kaizhangNV):
1. Honor the reply-promptly rule with ONE short holding ack, then PAUSE before doing expensive edit work. Do not batch-author 13 comment rewrites up front.
2. Inspect their side with READ-ONLY git first: `git fetch` + `git show <sha> --stat` + `git diff A..B` operate on committed objects and refs, NOT the working tree. NEVER `checkout`/`merge`/`reset` while a subagent is reading the same worktree — it corrupts the subagent's file reads mid-analysis.
3. Re-check the PR head before editing. Review comments don't move HEAD, but the maintainer's fix-commit does; the comment `commit_id` (from `gh api .../pulls/comments`) tells you which head the comments are pinned to.
4. If the maintainer self-resolved everything: KILL the now-moot investigation subagent, sync to their head, and post ONE standing-down comment ("you've addressed these in <sha>, standing down so we don't collide, flag anything still open"). Do NOT post N redundant "thanks" thread replies (meta-ack ban), and do NOT re-review the maintainer's own doc prose (over-reach).
5. A batch of "@bot rewrite this comment" from a maintainer actively pushing to the branch is not automatically a work order to duplicate — treat it as "make the PR clear" that they may complete themselves.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790226898754-maintainer-who-reviews-and-self-fixes-don-t-race-a.md`_
