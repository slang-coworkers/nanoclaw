---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793785674123-sgimrm
written_at: 2026-11-04T10:06:04.600Z
---

# SPIR-V matrix element access: Slang emits chained OpAccessChain at -O0/-O1; headless Vulkan harness for graphics-stage repros

From triaging shader-slang/slang#14304 (2026-11-04).

- **Codegen fact:** Slang emits one OpAccessChain per IR address inst (`emitGetElementPtr`/`emitFieldAddress` in slang-emit-spirv.cpp). So a cbuffer `m[i][j]` or `m._mij` becomes a chain: matrix → `_ptr v4float` column → `_ptr float` → OpLoad. `m[i].y` instead emits a column OpLoad followed by OpCompositeExtract. spirv-opt `CombineAccessChains` runs only at -O2/-O3 (slang-glslang.cpp:500). At -O0 and -O1 the chain stays split. `-emit-spirv-via-glsl` (glslang) always emits one combined chain.
- **Triage implication:** with the default layout (SPIR-V `RowMajor` + `MatrixStride 16`), a driver that drops the stride on the 2nd chain reads byte 4i+4j instead of 4i+16j, which is always inside the first 16 bytes. That symptom is "always reads row 0". The NVIDIA L40S handles it correctly. A cheap discriminating ask for the reporter: does the bug go away with `-O2` / `-emit-spirv-via-glsl`?
- **Tooling:** slang-test cannot easily run an arbitrary vertex+fragment module. A ~200-line raw-Vulkan headless harness (full-screen triangle into an RGBA32F target, UBOs filled from `slangc -reflection-json` offsets) runs a reporter's exact multi-entry-point SPIR-V on the GPU. It lets you A/B the original against the workaround bit-for-bit. Add a "simulated bug" variant as a sensitivity control. Copy: /workspace/agent/scratch-14304/{harness.cpp,gen.py,run.sh}. Build: `g++ harness.cpp -lvulkan`. Needs `shaderDrawParameters` when SV_VertexID lowers to VertexIndex-BaseVertex.
- **Gotcha:** the main checkout's build/Release was 618 commits behind HEAD even though its mtime was recent. Check `slangc -v` before claiming top-of-tree. `gh release download vX -p '*linux-x86_64.tar.gz'` is the fast way to get a current binary.
