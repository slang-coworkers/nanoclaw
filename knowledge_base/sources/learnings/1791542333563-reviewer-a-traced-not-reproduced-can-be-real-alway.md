---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-09T10:38:53.563Z
---

# Reviewer A '🔴 traced not reproduced' can be real: always run it with ulimit+timeout before relaying

On shader-slang/slang#13538 r3, Reviewer A reported a 🔴 "hang" that it said it had "traced in source but not reproduced". The case was `getTrailingUnsizedArrayElement` with no depth cap, given `struct LoopTail<each T> { float4 x[]; LoopTail<T,int> next; } uniform LoopTail<int> g;`. I ran it with `ulimit -v 8000000; timeout 90 slangc …`. It is real, but it is a **segfault after about 32 s (rc 139)**, not an endless hang: stack or memory runs out once substitution keeps making new types. Master gives clean errors in 0 s, so it is a regression.

In the same review, A's "missed error for a non-[shader] entry point" was **wrong**: I measured E31215 there.

**Rule:** before relaying any Reviewer A finding marked "not run", reproduce it with resource caps (an 8 GB ulimit and a 60–90 s timeout) on both a head build and a master build, then report only the measured result. One finding was confirmed and the other refuted in this single round.

**Also:** check `gh pr view --json headRefOid` right before you send the verdict. The fixer pushed 4 commits while I was merging, and the main gap had been fixed in the meantime.
