---
title: "slang amplification-shader payload: `out payload` is a DOC error; `groupshared`+DispatchMesh is the intended taskPayloadSharedEXT analogue (#8785)"
type: learning
topic: slang-compiler
source: learnings/1785803488417-slang-amplification-shader-payload-out-payload-is-.md
---

# slang amplification-shader payload: `out payload` is a DOC error; `groupshared`+DispatchMesh is the intended taskPayloadSharedEXT analogue (#8785)

For shader-slang/slang, the `coming-from-glsl` doc page tells users to replace GLSL `taskPayloadSharedEXT` with an `out payload T param` on an `[shader("amplification")]` entry point. **That syntax does not exist** — the compiler emits `warning 38040: parameter 'payload' is treated as 'uniform' because it does not have a system-value semantic`. Verified @HEAD 546ad18f7.

**Mechanism (the load-bearing asymmetry):** `slang-check-shader.cpp:2118-2154` has a `switch (stage)` enumerating stages that may have varying input. **`Stage::Mesh` IS listed; `Stage::Amplification` is NOT** → falls to `default: break` leaving `canHaveVaryingInput = false`. Any amplification parameter lacking a system-value semantic then gets `HLSLUniformModifier` force-added and warning 38040 emitted (`slang-check-shader.cpp:2203-2207`; diag defined `slang-diagnostics.lua:4452-4457`). So `payload` (a real modifier — `HLSLPayloadModifier`, parsed `slang-parser.cpp:10802`, groupshared-rate lowered `slang-lower-to-ir.cpp:4765`) works as **`in payload T` on the MESH entry point to RECEIVE** the payload (`tests/.../mesh/task-simple.slang:82`), and there is no `out payload` producer form on the amplification side.

**The intended idiom is `groupshared` — NOT a workaround.** `tests/pipeline/rasterization/mesh/task-groupshared.slang`'s own header comment says it outright: declare the payload `groupshared`, pass it to `DispatchMesh`, and "during lowering to GLSL and SPIR-V we'll have to identify this as the variable being passed to DispatchMesh and emit it using the `taskPayloadSharedEXT` rate." That is the direct analogue of the GLSL qualifier. `DispatchMesh` takes it by reference: `void DispatchMesh<P>(uint,uint,uint, __ref P meshPayload)` (`hlsl.meta.slang:20842-20845`).

**Trap when citing the other test:** `task-simple.slang` passes a plain *local* struct and looks like a second supported pattern, but it pins `AMPLIFICATION_NUM_THREADS_X = 1`, so it does not demonstrate anything that generalizes to a multi-thread group. Point people at `task-groupshared.slang`.

**Scope trap:** the offending page is **not in the slang repo** — `grep -rn taskPayloadSharedEXT` over the whole tree returns ZERO hits and there's no `coming-from-glsl*` file. It lives in the docs-site source, so a "fix the docs" issue filed against shader-slang/slang can't be closed by editing this repo. Check where a cited docs.shader-slang.org page actually lives before promising a docs fix.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785803488417-slang-amplification-shader-payload-out-payload-is-.md`_
