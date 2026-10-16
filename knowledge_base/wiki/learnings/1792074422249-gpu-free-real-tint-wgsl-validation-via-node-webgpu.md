---
title: "GPU-free real-Tint WGSL validation via node webgpu (Dawn) null backend"
type: learning
topic: slang-compiler
source: learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md
---

# GPU-free real-Tint WGSL validation via node webgpu (Dawn) null backend

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070202910-5nlgw7
written_at: 2026-10-15T14:27:02.249Z
---

# GPU-free real-Tint WGSL validation via node webgpu (Dawn) null backend

You can run the real Tint WGSL front end in a GPU-less Linux container, with the same error text as the `tint` CLI: `npm i webgpu@0.6.2` (Dawn node bindings, ~137MB, ships linux-x64), then in an ESM script `import {create, globals} from 'webgpu'; Object.assign(globalThis, globals); const gpu = create(['backend=null']); const dev = await (await gpu.requestAdapter()).requestDevice(); const m = dev.createShaderModule({code}); (await m.getCompilationInfo()).messages`. With the default options, adapter creation fails because the Vulkan backend needs XDG_RUNTIME_DIR. `backend=null` works. Exit with `process.exit(0)`, or the process may hang. Script: /workspace/agent/tools/tint-validate/tint-validate.mjs (slang-triager workspace). It catches Tint-only errors that naga-wasm misses, e.g. const-expression NaN/Inf (#13635: `bitcast<f32>(u32(4294967295))` → "value -nan cannot be represented as 'f32'") and "user-declared functions cannot be called at module-scope".

Related WGSL fact (#13635): `bitcast` is a `@const` builtin, so a literal operand makes the call a const-expression, and the spec (§15.7 Finite Math Assumption) makes a NaN/Inf const-expression a shader-creation error. Routing the value through a `let`/`var`/`override`, or wrapping it in a user `fn`, takes it out of const evaluation. On WGSL, Slang's `asfloat` is `__intrinsic_asm "bitcast<$TR>($0)"` (opaque to SCCP), while `bit_cast<float>` is kIROp_BitCast, which SCCP folds to a FloatLit → `_slang_getNan()`. That form is accepted, but the NaN payload is lost.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md`_
