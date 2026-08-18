---
title: "CB source-loc drop is IR-level real but MASKED on master by statement-granularity OpLine (verify observables yourself)"
type: learning
topic: slang-compiler
source: learnings/1784778798903-cb-source-loc-drop-is-ir-level-real-but-masked-on-.md
---

# CB source-loc drop is IR-level real but MASKED on master by statement-granularity OpLine (verify observables yourself)

**Issue #12192.** The ConstantBuffer source-location drop (CB field access re-synthesized loc-lessly in `slang-ir-lower-buffer-element-type.cpp`) is REAL at the IR-instruction level (confirmed by source-read: `_maybeSetSourceLoc` slang-ir.cpp:1825 sets loc from the builder's source-loc STACK, not the `setInsertBefore(user)` anchor, and the traverseUses bodies at :2035/:2272 don't push `IRBuilderSourceLocRAII(user->sourceLoc)`). BUT it is **NOT cleanly user-visible on master** via `-g2`/`-g1` SPIR-V debug info.

**Why masked:** Slang emits `OpLine`/`DebugLine` at **statement granularity**, not per-instruction. Every statement contains SOME loc-carrying inst (the local var decl, the assignment target, debug insts), so the block gets a correct statement-level `OpLine` that covers the loc-less CB access. Verified empirically @HEAD 56eb1aa08:
- Separate statements (`float a = cb.v;` line 10; `float b = sb[0];` line 11): CB access IS preceded by `OpLine 10` (CORRECT) — the CB AccessChain/Load don't emit their OWN OpLine, but the statement's OpLine covers them correctly.
- Multi-line statement (`outp[0] = sb[0] + cb.v;`): whole statement collapses to `OpLine 8` — BOTH sb and cb accesses under it, no CB-specific asymmetry.

**Method lesson (correction):** A build+run subagent reported "CONFIRMED master-reproducible" after seeing "CB access has no OpLine of its own." That's an IR-level truth mis-read as a user-visible symptom. I re-ran the exact repro myself and found the statement-level OpLine lands on the CORRECT line → NO clean visible symptom. **Always re-run a subagent's `reproduced` claim yourself and read the actual output before posting a public `reproduced` label** — the difference between "the inst carries no loc" and "the emitted debug info is wrong" is load-bearing. The clean user-visible symptom for this bug is the E55215 diagnostic (a direct `inst->sourceLoc` consumer, added by PR #12186) — a debug-info golden does not expose it because OpLine granularity is coarser than the drop. A `-g2` before/after regression test MAY still show a diff in a multi-line-statement case (fix would let the CB sub-expr emit its own finer OpLine) — but this was inconclusive in testing; the fixer, who holds both before/after states, should determine the regression vehicle.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784778798903-cb-source-loc-drop-is-ir-level-real-but-masked-on-.md`_
