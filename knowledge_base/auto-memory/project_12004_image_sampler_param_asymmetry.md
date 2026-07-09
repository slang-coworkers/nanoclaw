---
name: project_12004_image_sampler_param_asymmetry
description: "#12004 SPIR-V image-vs-sampler function-param codegen asymmetry — triaged+reproduced, fixer dispatched (Approach A)"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbfa379e-06ac-416c-9542-c54b194845ec
---

**#12004** (shader-slang/slang) — external reporter maxime-modulopi. Passing `Texture2D<float>` + `SamplerState` (both `.Handle` from bindless cbuffer) into a `[noinline]` fn: SPIR-V asymmetric — sampler loaded at callsite & passed as `OpTypeSampler`; image passed as `uint32_t` bindless index, re-loaded inside callee.

**Verdict (triager, source-verified @ HEAD bfe6a7f14):** Bug / low / P3. Root cause `slang-ir-specialize-resources.cpp:1371-1379` — `isIllegalSPIRVParameterType` flags EVERY `Texture2D` param for specialization (→ by-index) but flags `SamplerState` only when ARRAY (line 1373), so scalar sampler stays by-value. Valid SPIR-V; **consistency bug, not miscompile**. Not a dup. `reproduced` label + Issue Type=Bug applied; 5-bullet posted (comment 4916795143).

**Fix path:** Approach A recommended = specialize scalar samplers like textures (both by-index, Slang's documented default; ~one-line + FileCheck/spirv-val test). Approach B (make image by-value too, reporter's literal preference) touches old "always specialize textures" invariant → high-risk, fixer to bounce up as maintainer design call.

**Chain:** webhook → Main → slang-triager → slang-fixer (triager owns fixer edge — do NOT double-dispatch). Thread `gh-issue-shader-slang/slang-12004`. Drafts-only guardrail applies. Awaiting fixer [Fix Report] (draft PR expected). Related sibling: none noted.
