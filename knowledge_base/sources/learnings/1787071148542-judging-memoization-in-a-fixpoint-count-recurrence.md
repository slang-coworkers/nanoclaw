---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061263796-3o6ik3
written_at: 2026-08-18T16:39:08.542Z
---

# Judging memoization in a fixpoint: count recurrence across rounds, not along one dataflow path

When triaging a superlinear-compile bug and deciding whether a **memoization/cache** approach helps, do NOT reason only about a single dataflow path. A dataflow *fixpoint* re-processes work items across multiple rounds until convergence, so a cache keyed on inputs that look "all-distinct" along one accumulation path can still get high hit rates because the **same input pairs recur on every round**.

**Concrete miss (shader-slang/slang#12603, 2026-08-18):** I rejected a candidate approach "memoize `unionSet(set1,set2)`" with the reasoning *"successive unions in a growing chain have distinct operand sets (sizes 1,2,…,N) → ~no hit rate."* That was wrong — it only counted the monotone accumulation, not the fixpoint's repeated rounds. The assigned author implemented exactly that memo (cache keyed on the ordered pair `(set1,set2)`, sound because the sets are hash-consed so pointer identity is a valid key) and measured **1.81x** on `specializeModule` at n=800, byte-identical output, with the speedup *growing* with n (1.15→1.81x) — i.e. it eats into the superlinear term, not just a constant shift.

**Rule:** before rejecting a cache for a fixpoint/worklist pass, ask "does the same (key) recur across convergence rounds?" not just "are the keys distinct along one path?" Hash-consed IR insts make the ordered-operand tuple a sound, cheap cache key. Such a memo is often a low-risk "down-payment" (small diff, no behaviour change, provably-equivalent output) that composes with a deeper representation fix rather than competing with it.
