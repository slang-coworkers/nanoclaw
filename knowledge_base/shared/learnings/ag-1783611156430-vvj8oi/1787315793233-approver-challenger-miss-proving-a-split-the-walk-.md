---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787314956892-nvu72a
written_at: 2026-08-21T12:36:33.233Z
---

# [approver/challenger-miss] Proving a split-the-walk / add-a-memo IR refactor is output-neutral

## Symptom
A refactor splits one overloaded set/flag into two (e.g. slang#12608: `SpecializationContext`'s
`workListSet` was both "currently queued" (cleared on pop) AND "closure already walked"; the PR
adds a persistent `expanded` memo + iterative `workListStack`, replacing mutual recursion). The
headline is "no behavior change / byte-identical output". Prior precedents (#12343 simplifyCFG
walk-split, #12405 stateful-member leak) show this exact shape can silently regress while looking
inert — so "behavior-preserving" must be PROVEN per removed encoding and per state change, not
asserted.

## Root cause / how to catch it (the transferable probes)
For a memoized-forward-walk refactor, the ONLY dangerous direction is a **missed enqueue** (a
necessary re-processing silently dropped). Prove it cannot happen by separating the two channels:
1. **Direct enqueue vs. closure memo.** Confirm the enqueue of each direct user fires
   *regardless* of the memo — the memo must gate only whether that user's OWN closure is
   re-walked. If `enqueue(user)` sits outside the `if (memo.add(...))`, redundant walks are
   removed but no direct enqueue is dropped. (12608: `enqueue(user)` at :340, memo gate at :341.)
2. **Mutation-notification channel must bypass the memo.** After a rewrite, "re-consider the
   users of the changed inst" must still fire even if that inst is already memoized. 12608 does
   this with a `forceSeed=true` flag on `addUsersToWorkList` that re-enumerates direct users
   unconditionally. This is WHY output stays identical: the *speculative* forward walk is
   memoized (only repeat work elided) while *necessary* re-consideration after a mutation is
   forced. That separation is the whole correctness argument.
3. **Memo reset at every drain entry.** A persistent memo must be cleared at each drain start, and
   you must verify EVERY entry point routes through the reset (12608: `expanded.clear()` at the
   single `processSpecializationWorkListFromRoot`, through which both the module-wide and on-demand
   `specializeChildInsts` callers pass).
4. **Stale pointers in a persistent memo cannot alias new insts** — because Slang IR uses a
   bump-allocator `MemoryArena` (`source/core/slang-memory-arena.h`): memory is freed only on
   reset/deallocateAll/rewindToCursor, NEVER per-allocation. `IRInst::removeAndDeallocate`
   (slang-ir.cpp:9358) unlinks from parent but does not return the address to the arena, so a
   freed inst's address is not recycled within a drain. This is a reusable fact: any "is my
   persistent pointer-set safe against deletion?" question in an IR pass is answered by the arena
   not recycling addresses.

## Fix / bar
Require a **discriminating output control** test (12608 asserts concrete result values for
generics + autodiff + dynamic dispatch — the exact drivers of the walk; wrong order or dropped
re-consideration changes the values). Also: a claimed speedup may not reproduce — verify the
stated motivation against reality (here the issue author re-measured perf-neutral; the change
still stands on stack-safety + clarity + output-neutrality). Decision was WOULD_APPROVE; CI 51/51
green including all GPU + autodiff lanes.
