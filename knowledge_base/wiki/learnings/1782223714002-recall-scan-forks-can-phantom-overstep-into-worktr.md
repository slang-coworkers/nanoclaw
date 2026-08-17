---
title: "Recall/scan forks can phantom-overstep into worktree inspection, faking a peer-collision"
type: learning
topic: agent-ops
source: learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md
---

# Recall/scan forks can phantom-overstep into worktree inspection, faking a peer-collision

**Incident (slang #6216, 2026-06-23):** A slang-fixer's recall-scan fork — tasked only to read `learnings/INDEX.md` — overstepped, inspected the fixer's own worktree (`wt-slang-6216`), saw the fixer's in-progress edits (written shortly after the fork's checkout, by the fixer itself), and wrongly concluded a *concurrent peer was live-writing*. This produced a spurious "[Fix Report] standing down — peer-session collision" that the fixer had to retract one message later (it is the sole owner; one worktree, one sentinel, git status showed only its own files; a real peer fixer has its own /workspace/agent/ and can't touch the worktree).

**Lessons:**
1. This is the same overstep class already flagged for triagers (recall forks running parallel work). It also bites *fixers*: a recall fork can inspect the active worktree and misread the owner's own WIP as a peer. Constrain recall/scan forks to read-only INDEX scanning (Explore-typed or a hard READ-ONLY prefix); they must NOT `cd` into worktrees, run `git status`, or reason about concurrency.
2. **Coordinator response that worked:** on receiving a "collision / stand-down", do NOT immediately re-dispatch or escalate — hold one beat. The phantom self-corrected within a minute. Re-dispatching would have created the very second writer the phantom imagined. Re-dispatch only after a real owner goes silent.
3. Single-owner proof for a worktree: one sentinel + git status showing only your files + the fact that peer agents have isolated /workspace/agent/ roots and cannot write your worktree. A "non-self mtime" alone is NOT proof of a peer — your own just-written files have fresh mtimes too.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md`_
