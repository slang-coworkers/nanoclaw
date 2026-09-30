---
title: "precise/NoContraction: reference compilers disagree at call boundaries; Slang's walk dead-ends at spirv_asm intrinsics"
type: learning
topic: slang-compiler
source: learnings/1790706758785-precise-nocontraction-reference-compilers-disagree.md
---

# precise/NoContraction: reference compilers disagree at call boundaries; Slang's walk dead-ends at spirv_asm intrinsics

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790704695330-hqkhkt
written_at: 2026-09-29T18:32:38.785Z
---

# precise/NoContraction: reference compilers disagree at call boundaries; Slang's walk dead-ends at spirv_asm intrinsics

Measured 2026-09-29 (#13324) with the in-tree compilers. DXC SPIR-V: dlopen build/Release/lib/libdxcompiler.so (it has SPIR-V CodeGen) and call IDxcCompiler3 with `-spirv -O0 -fcgl`. DXIL: `slangc -pass-through dxc -target dxil-asm`. glslang: glslang_compile_1_2 in libslang-glslang. Harnesses are in /workspace/agent/scratch-13324 (dxcspv.cpp, gl2.cpp).

**Call boundary (the references disagree):**
- If the caller's `precise` result comes from a non-inlined callee, only DXC→DXIL marks the callee's math, because the callee is inlined by then. glslang and DXC→SPIR-V leave it unmarked.
- A callee's `precise` local marks the caller's argument math in both DXC backends, but not in glslang.

**DXC→DXIL ignores `precise` in these cases, even though DXC→SPIR-V and glslang honor them:** static/groupshared globals, a helper's `out precise` param, a helper's `precise` return type, and a reassigned `precise in` param.

**Slang (master 214064dd1), computePreciseInsts:**
- Intrinsics lowered via spirv_asm (dot, mul, abs, mad→Fma) are dead ends, so `dot(a*b+c,d)` gets 0 NoContraction where DXC gets 3. The op filter also excludes OpDot, OpMatrixTimes* and OpVectorTimesMatrix.
- CSE drops the decoration: `removeAndDeallocate` in slang-ir-redundancy-removal.cpp does not transfer it.
- The walk goes from a load to the buffer root and then to every store into that buffer, so unrelated outputs in the same RWBuffer get marked. Tests need separate in/out buffers.

**Counting pitfall:** spirv-asm output also comments `; NoContraction` on the instruction lines. Count with grep `OpDecorate .* NoContraction`, not a bare grep.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790706758785-precise-nocontraction-reference-compilers-disagree.md`_
