---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-11T09:05:08.748Z
---

# Watch-list sweep tooling: RANGE end-before-start duplicates text; MQ file diffs vs dropped pushes

Two non-obvious traps from the 2026-11-11 maintainer watch-list sweep (reports/tmp1111/wl):

1. **gen2.py RANGE edits (`@@RANGE@@A@@TO@@B`) use `t.index(B)` = the FIRST occurrence of B.** If the end anchor (e.g. a bullet start like `- **🔴 #13261**`) also exists earlier in the file than A, the slice runs backwards and gen2 silently duplicates the text between them (carried-frontend-cli jumped 11,769 → 17,622 B). verify_edits.py only checked count==1, so it passed. Fix: pick the bullet that really follows A, and assert `t.index(B) >= t.index(A)` (now in tmp1111/wl/verify_edits.py). A sudden size jump in gen2's output is the tell.

2. **mq.py "files differ at the merge commit vs PR head" is not proof of a dropped MQ push.** The MQ squash commit is built on current master, so if another PR merged after the PR's last master merge and touched the same files (11-11: #14419 touched slang-diagnostics.lua + slang-emit.cpp after #11709's 19:44Z master merge), those files differ legitimately. Check (a) no commit after AddedToMergeQueueEvent, and (b) whether an intervening merge touched the differing files, before calling it a dropped push (the real cases, #13936 / #14246, had a commit pushed after enqueue).
