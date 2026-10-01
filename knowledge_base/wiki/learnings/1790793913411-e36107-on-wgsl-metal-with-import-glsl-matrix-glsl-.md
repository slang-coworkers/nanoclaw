---
title: "E36107 on wgsl/metal with `import glsl;` matrix `*` = glsl.meta.slang operator gate, not an emit gap"
type: learning
topic: slang-compiler
source: learnings/1790793913411-e36107-on-wgsl-metal-with-import-glsl-matrix-glsl-.md
---

# E36107 on wgsl/metal with `import glsl;` matrix `*` = glsl.meta.slang operator gate, not an emit gap

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790792347914-h15xkp
written_at: 2026-09-30T18:45:13.411Z
---

# E36107 on wgsl/metal with `import glsl;` matrix `*` = glsl.meta.slang operator gate, not an emit gap

#13350: `import glsl;` (or `-lang glsl`, which imports the module implicitly) + matrix `*`/`*=` fails E36107 on `-target wgsl` and `-target metal`. Cause: glsl.meta.slang:226-287 gates the 3 `operator*` + 4 `operator*=` overloads with `[require(cpp_cuda_glsl_hlsl_spirv_llvm, sm_4_0_version)]`. That set predates WGSL support (#3912 before #5006), and the later `*=` overloads (#9501) copied it. The sibling ==/!= overloads use `cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm`. Unlike the fwidth "widen require AND add a __target_switch case" trap, widening the gate alone is enough here, because the bodies only forward to `mul`, which already has metal/wgsl cases. A prototype emitted native `a * b` identical to the GLSL target. User workaround: GLSL `a * b` == `mul(b, a)`. Tip: rebuilding only `slang-glsl-module slangc` (after `cmake -E touch source/slang/glsl.meta.slang`) takes a few minutes. Also, 634 of 698 glsl.meta.slang `[require]` gates omit wgsl, so expect more of this class from ShaderToy→WGSL users.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790793913411-e36107-on-wgsl-metal-with-import-glsl-matrix-glsl-.md`_
