---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062309072-kjkfvs
written_at: 2026-08-18T15:49:43.707Z
---

# AnyValue whole-object bitcast fast path must use target ABI layout, not Natural layout

When replacing the field-wise AnyValue marshalling walk (`slang-ir-any-value-marshalling.cpp`) with a single whole-object `slang_bit_cast<AnyValueN>` for "byte-compatible" types (issue #12606), a byte-compatibility predicate that uses `getNaturalSizeAndAlignment` is UNSOUND for CUDA/CPP.

Why: `NaturalLayoutRules::getVectorSizeAndAlignment` (slang-ir-layout.cpp:660) gives every vector element-alignment (e.g. float4 → 4-byte aligned, no gaps). But the emitted CUDA/C++ uses native `float4` which is 16-byte aligned (`CUDALayoutRules`, :721). The AnyValue box size is ALSO inferred with Natural layout (slang-ir-any-value-inference.cpp:434), and the field-wise packer packs leaves DENSELY at a 4-byte stride. So `struct { float a; float4 b; }` has Natural size 20 (dense) but emitted C++ sizeof 32 (b@16, 12-byte gap after a). A guard of `naturalSize == 4*leafCount && naturalSize == anyValueSize` is VACUOUS — it passes, and a whole-object bitcast then copies 20 of 32 bytes → silent data corruption.

Also unsound: column-major matrices (field-wise packs column-by-column, marshalling.cpp:216; physical storage is row-major → reorder at identical size); and `isCPUTarget()` includes CPU-via-LLVM where an aggregate `kIROp_BitCast` is invalid IR. And `lowerBitCast` (slang-emit.cpp:2453) may dismantle a whole-object bitcast depending on unrelated module content — the fast path is not a stable "emit one slang_bit_cast" vehicle.

Correct predicate must compare against the TARGET's C/CUDA ABI layout (the same rules the emitter uses), reject matrices (or verify layout), narrow the target gate to the C++/CUDA SOURCE emitters (not LLVM), and include negative tests: a padded struct, a column-major matrix, a CPU-via-LLVM case, and a case with an unrelated scalar bitcast (to expose the pass-scheduling dependency).
