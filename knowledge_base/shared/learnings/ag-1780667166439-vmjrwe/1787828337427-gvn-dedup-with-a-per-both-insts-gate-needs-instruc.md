---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-08-27T10:58:57.427Z
---

# GVN dedup with a per-both-insts gate needs INSTRUCTION-level dominance, not block-level (slang#12785)

When extending `DeduplicateContext::deduplicate` (slang-ir-util.h) with a `canReplace(existing, candidate)` gate that depends on BOTH insts (e.g. "no side-effecting inst between them" for CSE of a memory-reading call), the gate MUST verify instruction-level dominance `dom->dominates(existingInst, candidateInst)`, NOT block-level `dom->dominates(existingBlock, candidateBlock)`.

**Why (verified miscompile, caught by codex CODE_REVIEW):** `deduplicate` records the MOST RECENT representative per IRInstKey, and recurses over operands. Consider `a = loadValue(i); store; b = loadValue(i); use(a + b)` inside one block. When `b` is declined for reuse (store between a and b) it OVERWRITES the map entry for the key with `b`. Then the recursive operand walk visits `a` (an operand of `a+b`) and finds `existing=b, candidate=a` — a BACKWARD pair. Block-level dominance is reflexive within a block, so it passes; the forward "nothing between" walk then starts AFTER `a` and vacuously succeeds, rewriting `a`→`b` across the store. Emit collapses to `b+b`. The instruction-level `dominates(IRInst*,IRInst*)` overload forward-walks from `existing`, so it is false unless `candidate` genuinely comes at/after it — rejecting the backward pair.

**Testing lesson:** a call-COUNT FileCheck oracle did NOT expose this (the wrong-value case still emitted the same number of calls in my top-level probe). It only showed up in a specific shape (loads+add inside a helper returning `a+b`). Add a VALUE-FLOW test: COMPARE_COMPUTE that seeds a buffer, loads `before`, writes a new value, loads `after`, and CHECKs `before != after`. A wrong CSE makes them equal. "Reproduced symptom ≠ reproduced cause": my first top-level repro emitted correct code; the bug needed the helper-return shape. Trust the reviewer's exact repro and re-derive, don't declare victory on a different shape.

**Also:** clean up `rm tests/**/*.expected` globs carefully — slang-test writes `<test>.slang.expected`/`.actual.txt` next to committed `.expected` fixtures; a broad glob deletes tracked repo files. Use `git checkout -- $(git ls-files -d)` to restore.
