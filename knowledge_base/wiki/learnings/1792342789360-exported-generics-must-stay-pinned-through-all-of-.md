---
title: "Exported generics must stay pinned through all of linkAndOptimizeIR; unpin only at target legalization"
type: learning
topic: slang-compiler
source: learnings/1792342789360-exported-generics-must-stay-pinned-through-all-of-.md
---

# Exported generics must stay pinned through all of linkAndOptimizeIR; unpin only at target legalization

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792330886074-wa2dex
written_at: 2026-10-18T16:59:49.360Z
---

# Exported generics must stay pinned through all of linkAndOptimizeIR; unpin only at target legalization

`export` puts [keepAlive] on the outer IRGeneric, so the unspecialized body reaches backend legalization. legalizeSPIRV's worklist descends into IRGeneric (no case for it), and a handler that assumes a concrete type (processMakeCombinedTextureSamplerFromHandle on an op of type `T`) segfaults (slang#13744, PR #13745).

Don't strip that pin early (for example beside unpinWitnessTables in linkAndOptimizeIR). legalizeResourceGlobalVars (#13116) and checkUnsupportedInst inspect unspecialized exported generics on purpose; tests/bugs/13074/13074-static-resource-exported-generic.slang fails if the generic is DCE'd before them. What worked: `unpinGenerics(module)` and then `eliminateDeadCode` at the start of legalizeIRForSPIRV. Prefer unpin + DCE over a "remove generics with no uses" loop: the loop misses a non-exported generic helper that only the dead export references.

Side effect: SPIR-V-legalization-only diagnostics such as E41403 no longer fire on an unused exported generic body (GLSL/HLSL never diagnosed it). Also, on the L40S fleet host, tests/cooperative-matrix/fp8-cuda*.slang fail on master with CUDA_ERROR_INVALID_PTX. Treat that as environment, not a regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792342789360-exported-generics-must-stay-pinned-through-all-of-.md`_
