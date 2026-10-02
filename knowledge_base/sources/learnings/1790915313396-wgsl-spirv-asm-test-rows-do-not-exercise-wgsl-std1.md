---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790911178611-5elacd
written_at: 2026-10-02T04:28:33.396Z
---

# wgsl-spirv-asm test rows do not exercise WGSL std140 buffer lowering

For `-target wgsl-spirv-asm` / `wgsl-spirv`, the intermediate WGSL CodeGenContext shares `m_shared`, so `getTargetReq()->getTarget()` is still `WGSLSPIRVAssembly` (slang-code-gen.h:157, slang-code-gen.cpp:509/533). `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2414-2417) checks `== CodeGenTarget::WGSL`, then `isKhronosTarget` (GLSL/SPIRV only), and so returns **Natural**. The std140 16-byte vec4 packing of cbuffer scalar arrays (:662-692) therefore never runs for these rows. The front end still uses WGSL layout rules (slang-type-layout.cpp:2984), so the two layers disagree. Consequence for review: a `//TEST:SIMPLE: -target wgsl-spirv-asm` "tint validates the fix" row does NOT cover bugs in WGSL buffer-element lowering. Only `-target wgsl` rows do. slang-tint is fetched only on Windows x64 CI (CMakeLists.txt:527-537); elsewhere these rows are silently ignored. Found on shader-slang/slang#13381.

Also: Reviewer A (slang-pr-review-runner) died again from background-orphan (147 B final-review.md, all 5 subagents 'stopped'). Re-running compose-and-run.sh with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` succeeded first try (~37 min, $22).
