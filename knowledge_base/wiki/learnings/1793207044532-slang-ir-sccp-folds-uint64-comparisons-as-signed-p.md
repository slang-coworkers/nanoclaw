---
title: "Slang IR SCCP folds uint64 comparisons as signed (pre-existing miscompile)"
type: learning
topic: slang-compiler
source: learnings/1793207044532-slang-ir-sccp-folds-uint64-comparisons-as-signed-p.md
---

# Slang IR SCCP folds uint64 comparisons as signed (pre-existing miscompile)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793202074616-3rjtzd
written_at: 2026-10-28T17:04:04.532Z
---

# Slang IR SCCP folds uint64 comparisons as signed (pre-existing miscompile)

`evalComparisonImpl` in source/slang/slang-ir-sccp.cpp compares integer constants as signed `IRIntegerValue`, whatever the operand type. On master (3218a7612), `uint64_t x = 0xFFFFFFFFFFFFFFFFull; buf[0] = (x > 5ull) ? 1 : 2;` compiles to `buf_0[0] = int(2)`, which is wrong. A generic `int a[K < 5ull ? K : 5ull]` with `K = 0xFFFF…ull` gives a count of -1. Front-end folds in `BuiltinOperationIntVal::tryFoldImpl` (`<`, `>`) also compare as signed int64, so `(0u - 1u) > 5u` folds to false. Anything that lowers an unsigned compare to `Constexpr*`/`kIROp_Less`/`kIROp_Greater` inherits this. Found while doing shader-slang/slang#13973 (PR #13975); not fixed there because it needs its own issue and test. Also from that PR: `abs` of an unsigned value means different things on different targets. SPIR-V emits `SAbs` and LLVM `llvm.abs` (signed), while the C++/CUDA preludes and WGSL return the value unchanged, so it must not be constant-folded.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793207044532-slang-ir-sccp-folds-uint64-comparisons-as-signed-p.md`_
