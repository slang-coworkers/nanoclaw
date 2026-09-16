---
title: "Address-space specialization: recursion under -disable-non-essential-validations, and keying cycle detection on the stable root"
type: learning
topic: ci-tooling
source: learnings/1789475023606-address-space-specialization-recursion-under-disab.md
---

# Address-space specialization: recursion under -disable-non-essential-validations, and keying cycle detection on the stable root

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-09-15T12:23:43.606Z
---

# Address-space specialization: recursion under -disable-non-essential-validations, and keying cycle detection on the stable root

The Slang address-space specialization pass (`slang-ir-specialize-address-space.cpp`, shared by SPIR-V/Metal/WGSL) assumes an **acyclic call graph** — an invariant E55201 (recursion check) guarantees ONLY when `shouldRunNonEssentialValidation()` is on. Under `-disable-non-essential-validations`, recursion reaches the pass and breaks it in several distinct ways. Fixing it (shader-slang/slang#12563, review response to a maintainer) took 4 codex CODE_REVIEW rounds because each partial fix exposed the next failure mode:

1. **A guard/memo keyed on an identity that CHANGES each recursion level cannot detect a cycle.** `specializeFunc` clones the function per (func, argAddrSpaces) key, and `cloneInst` rewrites the recursive self-call to point at the *clone* — so every recursion level is a fresh IRFunc identity. A `HashSet<IRFunc*>` "in-progress" guard keyed on the callee never sees a repeat → unbounded clone chain → SIGSEGV. **Key cycle detection on the STABLE thing: the specialization *root*** (the ultimate original a clone descends from). Record `clone -> root` at clone time; break the cycle when a specialization would re-enter a root already on the stack.

2. **Break the cycle by reusing the callee AND caching that decision** (`functionSpecializations[key] = callee`). Without caching, the eager-descent guard only stops the current stack frame; the worklist's later revisit misses the key (root no longer on the stack) and clones again — an unbounded chain *iteratively*.

3. **A fixpoint's convergence depends on monotonicity.** The function result address space must transition monotonically (Generic → concrete). If two returns disagree on the address space (target-invalid, reachable via recursion), "last return processed wins" flips the result every drain → `retValAddrSpaceChanged` stays true → infinite requeues. Fix: derive the result from the **first concrete return in iteration order** (deterministic), so it stabilizes. NOTE: "only set when Generic" is WRONG — a bare `T*` result type starts at a non-Generic *default*, so that guard skips the legitimate default→concrete re-derivation and silently drops diagnostics.

4. **Per-drain worklist dedup** (`processedThisDrain`) bounds the drain when a recursive call re-adds its callee on every visit (the `!hasSpecializableArg` `workList.add(callee)` path also hangs on pointer-free recursion like `fib`).

Termination proof for the pass = bounded clones (root-guard+cache) + bounded per-drain work (dedup) + bounded drains (monotonic first-concrete-return result).

**Process lesson:** enumerate recursion pathologies with CONTROLLED PROBES before claiming a fix — direct pointer-return, scalar-return, permuted-address-space (`recurse(a,b)->recurse(b,a)`), AND pointer-free (`fib`). Codex reproduced permuted-crash and scalar-hang that my "it only affects the reported case" reasoning missed. Also: a separate dead-function-removal bug — a single pass over an unordered `functionsToConsiderRemoving` orphans a callee still used by a to-be-removed caller (Metal "Unknown addressspace encountered"); make removal a fixpoint (order-independent).

**Test lesson:** the reporter's crash reproduced only via the CROSS-MODULE linked extern-test (device-executed → doesn't run Metal emit on Linux). A single-file struct-by-value repro did NOT reproduce. The portable regression test is a compile-only `-target metal` build of the linked modules (`//TEST:COMPILE` the libs, then `//TEST:SIMPLE(filecheck=METAL): -r ... -target metal`) — needs no GPU, runs on Linux CI, fails pre-fix / passes post.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789475023606-address-space-specialization-recursion-under-disab.md`_
