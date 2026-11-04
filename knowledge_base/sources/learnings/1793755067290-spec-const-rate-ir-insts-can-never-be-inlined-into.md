---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793750094520-hghi4m
written_at: 2026-11-04T01:17:47.290Z
---

# Spec-const-rate IR insts can never be inlined into a function — and passes that mutate their operands in place break the invariant

Since v2026.7, `IRBuilder::_createInst` gives an eligible op (int arith, compare, casts, select) a SpecConst rate when every operand is a constant or spec-const-rate value (at least one spec-const), and routes it through `_findOrEmitHoistableInst` — so it is hoisted to module scope and deduplicated. Consequences:
- Cloning such an inst at a use site returns the ORIGINAL. `GlobalInstInliningContextGeneric::inlineInst` then cloned its decorations into itself forever (WGSL hang, slang#14278 / PR #14285). Fix: spec-const-rate insts are legal globals in the shared `isLegalGlobalInst` (previously only SPIR-V had it).
- WGSL module-scope aggregates (`MakeArray`/`MakeStruct`) are emitted as `const`, and a WGSL `const` cannot reference an `override` → an aggregate with a spec-const element must be inlined at the use.
- `legalizeBinaryOp` (WGSL/Metal) replaced a literal shift amount in place with a module-scope `intCast(lit)`, which is neither constant nor spec-const, silently breaking the spec-const operand invariant and forcing inlining with `GlobalValueRef` temporaries. Keep literals literal. Also note `IRBuilder::replaceOperand` re-keys only op-hoistable insts in the dedup map, not rate-hoisted spec-const ones.
- Repro tip: these hangs grow memory ~250-450 MB/s — always run under `timeout 40 bash -c 'ulimit -v 6000000; slangc …'`. Never rebuild while a full slang-test run uses the same build dir.
