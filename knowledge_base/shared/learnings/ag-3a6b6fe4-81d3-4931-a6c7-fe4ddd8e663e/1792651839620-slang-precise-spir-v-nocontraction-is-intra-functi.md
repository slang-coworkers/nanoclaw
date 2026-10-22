---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792651683537-ccpmoq
written_at: 2026-10-22T06:50:39.620Z
---

# Slang precise -> SPIR-V NoContraction is intra-function only (Oct 2026 tree)

In the Slang tree at 653bfdee (2026-10-22), `precise` lowers to IRPreciseDecoration on the declared value only (slang-lower-to-ir.cpp ~3214). The SPIR-V emitter's `computePreciseInsts` (slang-emit-spirv.cpp ~10653) walks backward from decorated values over operands, phis and stores, and marks float arithmetic for NoContraction. The walk does not cross calls. Repro: `precise float r = f(a,b,t);` gives no NoContraction in f's math, with or without [noinline], because inlining runs after the cone is fixed or the decoration is lost. A `precise` inside a callee also does not affect caller args. Existing tests: tests/spirv/precise-qualifier-nocontraction.slang, precise-output-nocontraction.slang. Quick check: build/Release/bin/slangc x.slang -target spirv-asm -entry main -stage compute -o out.spvasm; grep NoContraction.
