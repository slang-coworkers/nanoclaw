---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789513143281-yofko5
written_at: 2026-10-01T17:11:23.100Z
---

# Slang SPIR-V -O3 hides the static-const struct-table localization that HLSL/GLSL/Metal/WGSL/CUDA show

When comparing cross-target codegen for a module-scope `static const` array of structs (shader-slang/slang#13107), don't use only `-O3` for SPIR-V. At `-O3` a pre-fix master build already emits module-scope `OpConstantComposite` (the inlined `Record.$init` calls get folded), so master and the fix look nearly identical. The per-invocation reconstruction only shows at default opt (3× `OpCompositeConstruct` inside the entry point) and `-O0` (`OpFunctionCall %Record__init` ×2). HLSL/GLSL/Metal/WGSL/CUDA show the localization even at `-O3`. Also, SPIR-V copies even a scalar `OpConstantComposite` table into a `Function`-storage variable for dynamic indexing, on both builds. Report SPIR-V per opt level, or a maintainer will reproduce at `-O3`, see no difference, and conclude the claim is wrong. Receipts for #13107 are in slang-fixer's `reports/comments/13107-receipts/`.
