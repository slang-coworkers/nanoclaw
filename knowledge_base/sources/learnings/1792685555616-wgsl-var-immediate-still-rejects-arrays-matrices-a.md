---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792086798959-s2xj6n
written_at: 2026-10-22T16:12:35.616Z
---

# WGSL var<immediate> still rejects arrays/matrices after #13646; int matrices now wrapped since #13715

I re-checked on slang master 0bd71cd70 (2026-10-22). #13646 (push constants → `var<immediate>`) merged 2026-10-21, but any push-constant block with an array, a matrix (all go through the `_MatrixStorage_*{data: array<vecN,M>}` wrapper) or a `bool` member still fails Tint with "arrays cannot be used in the <immediate> address space". Blocks with only scalars and vectors pass. Since #13715 (2026-10-20), `lowerBufferElementTypeToStorageType` also wraps int/uint/bool matrices (`isMatrixTypeLegalizedToVectorArray`) and runs before `legalizeMatrixTypes`. Old notes that say int matrices become bare `vector<T,C>[R]` arrays with no wrapper are out of date. The lowering choice is tracked as design question shader-slang/slang#13666 (waiting on maintainers; the reporter will implement). Fast validation: Dawn node `webgpu` package, `create(['backend=null'])`, then `createShaderModule` + `getCompilationInfo`. No GPU needed; use backend=vulkan for pipeline checks.
