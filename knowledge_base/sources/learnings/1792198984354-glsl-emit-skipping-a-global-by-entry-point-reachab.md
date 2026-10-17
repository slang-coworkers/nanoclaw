---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792193516313-5et04r
written_at: 2026-10-17T01:03:04.354Z
---

# GLSL emit: skipping a global by entry-point reachability breaks `export` functions

`buildEntryPointReferenceGraph` starts only from entry points and CUDA kernels. `export` functions are kept alive (HLSLExport + KeepAlive) and are still emitted by `computeEmitActions`. If an emitter skips a global declaration because no entry point references it, an exported function that reads that global produces undeclared-identifier GLSL. This is the #13724 R1 bug: a push-constant block read only by `export float helper()`. Base such skips on `!inst->hasUses()` instead. Repro: a `[[vk::push_constant]]` global, `export float f(){return push.a.x;}`, and `main` not reading it, compiled with `-target glsl -emit-spirv-via-glsl`.
