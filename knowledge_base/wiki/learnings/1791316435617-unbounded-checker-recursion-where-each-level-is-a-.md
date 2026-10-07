---
title: "Unbounded checker recursion where each level is a NEW type defeats identity guards; two-state + growing-stack test proves it"
type: learning
topic: misc
source: learnings/1791316435617-unbounded-checker-recursion-where-each-level-is-a-.md
---

# Unbounded checker recursion where each level is a NEW type defeats identity guards; two-state + growing-stack test proves it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791310838219-kgr137
written_at: 2026-10-06T19:53:55.617Z
---

# Unbounded checker recursion where each level is a NEW type defeats identity guards; two-state + growing-stack test proves it

Found while triaging slang#13461. The issue was a TLA+-model report claiming "unbounded backtracking"; the solver doesn't backtrack at all, but a nearby real crash existed.
- **Real bug.** `extension<T> T : IRec<T> where T : IOther<T> {}` plus any `struct Z : IOther<Z>` gives a stack-overflow SIGSEGV with no diagnostic. It's a regression from #11210 (79ac457f0).
- **Mechanism.** Witness-shape inference calls the SYMMETRIC `TryJoinTypes` (slang-check-constraint.cpp ~:1807). It swaps operands when sub is an interface (:404) → `isSubtype(IOther<IOther<Z>>, IOther<Z>)` → inheritance of a strictly larger type → the same extension applies again.
  - Every level is a new Type*, so `isComputing`, the extension-circularity check and the subtype cache (all identity-keyed) never fire.
  - A 2nd independent leg: `cacheSubtypeWitness` computes the SUP type's inheritance generation even when the sub is in progress. Both legs must be cut; each alone still overflows.
- **Technique.**
  1. Run the repro at `ulimit -s` 2MB/8MB/64MB. If it always crashes and wall time grows with the stack, the recursion is unbounded, not merely deep-but-finite.
  2. No gdb in the container: build an LD_PRELOAD SIGSEGV handler with sigaltstack + backtrace(), then `addr2line -e libslang-compiler.so.<ver>.dwarf` (Release ships a .dwarf sidecar) to get symbolized frames.
  3. Print `type->toString()` at `_getInheritanceInfo` entry; it shows the growing type immediately.
  4. Two-state build of the suspect commit vs its parent in a scratch worktree (Release slangc only, ~10 min on 64 cores).
- **Prior art.** A recursion budget with an E39997-style diagnostic (`kMaxTypeNestingDepth`) is principled only for the genuinely non-terminating shape (`Wrap<X> : I where Wrap<Wrap<X>> : I`, broken since 2025.1). It is not a fix for the regression, which terminated before #11210.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791316435617-unbounded-checker-recursion-where-each-level-is-a-.md`_
