---
title: "postmortem: shader-slang/slang#13249 superseded by PR #13254"
type: learning
topic: slang-compiler
source: learnings/1790814920619-postmortem-shader-slang-slang-13249-superseded-by-.md
---

# postmortem: shader-slang/slang#13249 superseded by PR #13254

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-01T00:35:20.619Z
---

# postmortem: shader-slang/slang#13249 superseded by PR #13254

**Issue:** shader-slang/slang#13249. Adding `-g` stopped `-loop-inversion` from inverting a simple `do { if (i<10){} else break; ... } while(true)` loop.

**Approaches:**
- **Ours: draft PR #13255** (fix/issue-13249, opened 2026-09-24 07:03Z and never undrafted). It added a shared `isDebugInst()` in `slang-ir-util` covering DebugLine, DebugScope, DebugNoScope, DebugVar, DebugValue, DebugInlinedAt and DebugInlinedVariable. `isSmallBlock` ignored all of them. The trivial-branch match also skipped any debug inst that had **no uses**.
- **Merged: maintainer pdeayton-nv's PR #13254** (opened 09-24 07:01Z, merged 09-30 11:04Z). It added a file-local `isDebugLocationOrScopeMarker()` that ignores **only DebugLine, DebugScope and DebugNoScope**. Its comment explicitly says DebugVar and DebugValue "carry variable state, so they must not be ignored."

**The concrete delta:** ours had a latent correctness bug. A `DebugValue` has no result users, so our use-based skip treated it as ignorable. A break block holding `debugState = 7` (a DebugValue) would then match as "trivial" and be erased, silently dropping the debug variable update. #13254 pins exactly this negative case in `tests/ir/loop-inversion-debug-value.slang` (SPIR-V `-g2`/`-g3` FileCheck: the DebugValue survives and the loop is NOT inverted). It also adds `tests/debuginfo/loop-stepping.slang`. Ours tested only `-g` HLSL ordering and a CPU run. Our patch was also wider: it refactored `isDebugInst` out of `slang-ir-propagate-func-properties.cpp` into a shared util.

**Process factor:** our draft was fix-complete and reviewer-approved by 09-25 01:42Z. It was then held for 5 days pending an operator go-ahead for the issue 5-bullet and for marking it ready. The maintainer's PR, opened 2 minutes before ours, merged in the meantime.

**Transferable rules:**
1. When making a pass ignore debug insts, split them by role: **location/scope markers** (DebugLine/DebugScope/DebugNoScope) are safe to skip. **Variable-state insts** (DebugVar/DebugValue) are not, even when they have zero uses, because erasing or moving them changes what the debugger observes. "No uses" is not a safe proxy for "erasable".
2. For any `-g` parity fix, add a **negative test** with a debug-observable variable update on the path the transform would erase, checked in SPIR-V debug output (`-g2`/`-g3`). An HLSL-ordering check alone is not enough.
3. When a maintainer opens a PR on the same issue, flag the overlap to the operator immediately. An operator-held draft racing a human PR will lose.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790814920619-postmortem-shader-slang-slang-13249-superseded-by-.md`_
