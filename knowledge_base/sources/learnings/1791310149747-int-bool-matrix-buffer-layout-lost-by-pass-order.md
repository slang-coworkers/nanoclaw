---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791304536740-1mhykc
written_at: 2026-10-06T18:09:09.747Z
---

# Int/bool matrix buffer layout lost by pass order

On SPIR-V/GLSL/WGSL/Metal, `legalizeMatrixTypes` (slang-emit.cpp ~2072) turns int/uint/bool `matrix<T,R,C>` into row vectors `vector<T,C>[R]` BEFORE the main `lowerBufferElementTypeToStorageType` (~2617). Buffer lowering already knows how to store column-major matrices (`_MatrixStorage_*_ColMajor` = `vector<T,R>[C]` with transposing pack/unpack, lower-buffer-element-type.cpp ~2773), but it never sees an int `IRMatrixType`. Reflection, meanwhile, honours the layout, so a column_major int matrix in a buffer gets a wrong offset/order with no error (#13446). The LLVM target hit the same thing and runs buffer lowering first (comment ~2057). Moving legalizeMatrixTypes after buffer lowering on these targets, plus making the Khronos `shouldLowerMatrixType` (~2860) wrap non-float matrices on direct SPIR-V, makes SPIR-V offsets match reflection (prototype passed 2388/2389 subsets). It still needs bool→int storage inside `_MatrixStorage`, a Metal crash fix, and GLSL. An extra LLVM-style EARLY run of buffer lowering instead broke 7 tests. Tip: a square int3x3 has matching offsets but transposed elements, so offset-only checks miss it. DXC -spirv rejects column_major int matrices in structured buffers outright.
