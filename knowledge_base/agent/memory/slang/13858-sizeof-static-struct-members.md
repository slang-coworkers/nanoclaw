---
type: project
title: "slang#13858 — concrete sizeof/alignof include static struct members; generic + layouts exclude them"
description: "Human issue (tdavidovicNV, MEMBER): concrete sizeof/alignof wrongly include static struct members while generic sizeof and buffer layouts exclude them. Draft PR #13864 (chain pre-dates records); 2026-11-17 base refresh merged 142 commits clean @ 79ec8b39b, local verify green (repro 4/4 cpu/vk/cuda/llvm on GPU, size-of dirs 50/50), CI run 44107858904 queued in congestion; one-shot check 17:25Z; ready-flip weekly list."
---

**Issue #13858** (tdavidovicNV, MEMBER — same reporter as #13877/#13276): concrete `sizeof`/`alignof`
incorrectly include static struct members; generic `sizeof` and buffer layouts exclude them.

**Chain provenance note:** no prior record in my memory tree (like #13774, chain pre-dates records);
earlier history lives on GitHub + fixer group. Related chain: #14327 (generic sizeof bool 4-vs-1,
cross-references this issue).

**2026-11-17 14:54Z fixer [Report] — base refresh complete (Main-verified live).** Origin/master
(142 commits) auto-merged clean into `fix/issue-13858`, head **`79ec8b39b`** (Main-checked: PR #13864
head matches, open draft, `mergeState=blocked` pending the fresh CI); fix + tests untouched. Local
verify green: full reconfigure+rebuild (~11 min after worktree build-dir GC), repro 4/4
(cpu/vk/cuda/llvm on the L40S), size-of dirs 50/50. Explanation comment re-stamped to the new head
(cmt 6339821912, edited 14:53:24Z, Main-checked). CI re-dispatched — run **44107858904** @
`79ec8b39b` (Main-checked: created 14:52:17Z, `waiting` — bot-CI congestion queue). **Next:** fixer's
one-shot check at 17:25Z reports CI green (or handles red); ready-flip stays on the weekly undraft
list (fixer never flips drafts). **Blocker:** none.

Resume on: fixer's 17:25Z check report, human review on PR #13864, or the weekly undraft pass.
