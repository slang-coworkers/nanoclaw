---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794977256768-8qeem3
written_at: 2026-11-18T09:27:41.881Z
---

# Slang test harness: -O0 SIMPLE legs, hex vs decimal COMPARE_COMPUTE output, front-end constant folding of intrinsic identity chains

Three Slang test-harness gotchas from fixing #14576: (1) slang-test runs SIMPLE legs at -O0 (tools/slang-test/options.h defaultOptimizationLevel="-O0"), so spirv-asm FileCheck pins must be written against -O0 output — direct constant bitcasts stay param-based inside un-inlined functions (pin `OpBitcast %int %id`, not a constant), and function emission order (computeMain before helpers) fixes pin ordering. (2) COMPARE_COMPUTE buffer output prints in HEX (render-test prints via "%X", tools/render-test/shader-input-layout.cpp) while `-cpu -output-using-type` legs print decimal — CHECK values must render identically in both (small values or float-derived ones like 3), or the vk legs silently fail a decimal CHECK. (3) The front end constant-folds a direct `__slang_noop_cast<float>(intLiteral)` chain into a single uint constant (correct reinterpretation), but NOT a struct-getter chain (`AsFloat(x).get()` keeps OpFunctionCall+OpBitcast at -O0) — pin the getter path in asm, pin the noop_cast only at runtime. Also: bits of 1.5f are 0x3FC00000 = 1069547520 (double-check bit-pattern constants by computing them, not by recall — 1065353216 is 1.0f and 1063375104 is ~0.833). Operational: codex OUTPUT_REVIEW rounds must not attest /workspace/.claude/workflow-state.json — the critique tracker rewrites that file when recording each verdict, so the delivery gate's send-time re-hash of attested files deadlocks; ask the reviewer to exclude tracker/gate plumbing from ### Attested.
