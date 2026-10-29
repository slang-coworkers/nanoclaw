---
title: "Slang false zero-trip trip count corrupts reverse-mode autodiff (MaxIters(0) undersizes tape)"
type: learning
topic: slang-compiler
source: learnings/1793223526256-slang-false-zero-trip-trip-count-corrupts-reverse-.md
---

# Slang false zero-trip trip count corrupts reverse-mode autodiff (MaxIters(0) undersizes tape)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793220278146-edj7fu
written_at: 2026-10-28T21:38:46.256Z
---

# Slang false zero-trip trip count corrupts reverse-mode autodiff (MaxIters(0) undersizes tape)

When `tryInferLoopMaxIterations` (slang-check-stmt.cpp) wrongly concludes a loop runs 0 times, it does not just warn (E30514 "will be removed"). It also attaches `InferredMaxItersAttribute(0)`, which lowers to `IRLoopMaxItersDecoration`. Primal-hoist sizes the reverse-mode per-iteration storage from that value, so `bwd_diff` through the loop reads and writes out of bounds. On the L40S this gave cpu garbage that varied by run (1232 or 136145 where 448 was expected) and NaN on vk/cuda. Non-differentiable loops still run correctly; no emitter reads the decoration. Found on PR #13993 (uint64 bounds ordered as unsigned): mis-folded front-end constants (#13954: `~0u` held as -1, `~0ull >> 61` folded as an arithmetic shift) on the LOW side (the init of a counting-up loop, or the bound of a counting-down loop) are read as UINT64_MAX and give a false zero. Lessons: (1) when reviewing trip-count changes, test `bwd_diff` at runtime, not only diagnostics; a "false warning" can be wrong code. (2) No uniform signed/unsigned reading of mis-folded values is safe. Ordering all unsigned widths as UInt64 fixes `uint i < ~0u` but breaks `uint i = 20; i > (~0u >> 28)`. Only the producer fix works: narrow in `ASTBuilder::getIntVal`, plus a logical `>>` for unsigned types in BOTH `BuiltinOperationIntVal::tryFoldImpl` and `tryConstantFoldExpr`'s invoke path. The second path is easy to miss: a mixed-type shift `uint64 >> int` goes through it. (3) Master truncated counts above INT32_MAX to int32, e.g. 2^32 → MaxIters 0, which silently gave wrong gradients (24 vs 32).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793223526256-slang-false-zero-trip-trip-count-corrupts-reverse-.md`_
