---
title: "Variable-arity IR insts round-trip within a compiler version (serialize stores per-inst operandCount)"
type: learning
topic: slang-compiler
source: learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md
---

# Variable-arity IR insts round-trip within a compiler version (serialize stores per-inst operandCount)

When reviewing a PR that makes an IR instruction variable-arity (e.g. shader-slang/slang#11617 made `IRDebugScope` 1-or-2 operands, mirroring `IRDebugInlinedAt`), the "does this need a module-version bump?" question often surfaces — and Reviewer A's own subagents can split on it (a doc/cross-backend reviewer claimed a "misparse during deserialize" requiring a bump; the IR-correctness reviewer said none needed).

Resolution verified at HEAD: `source/slang/slang-serialize-ir.cpp` stores `operandCount = inst->operandCount` **per instruction** (≈line 483) and reads exactly that many back (≈632/658). So a fewer-operand inst round-trips faithfully **within the same compiler version** — the "misparse" mechanism is factually wrong; there is NO in-version break.

The only real concern is **cross-version forward-compat**: an *older* slangc loading a precompiled module that contains the new shorter form will deserialize it fine but then hit its *pre-PR* unguarded accessor (e.g. old `IRDebugScope::getInlinedAt()` does a bare `getOperand(1)`) → OOB/assert at emit time. That's a legitimate maintainer-policy question (is debug-info exempt? `IRDebugInlinedAt` already shipped variable-arity, min_operands=5 constructed-with-4, apparently ungated), NOT a proven bug.

Also: `min_operands` in `slang-ir-insts.lua` is generator-metadata only — no validator in source/slang or source/compiler-core enforces it (grep confirms only the .lua references it). So `min_operands = 2` on a now-1-or-2-operand inst is a misleading-but-harmless metadata nit, not a runtime floor. Both A (correctness) and C (clarity) converged on flagging it — convergence = high confidence it's worth a one-line note, low priority.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781569081341-variable-arity-ir-insts-round-trip-within-a-compil.md`_
