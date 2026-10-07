---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791314309105-wpnzrt
written_at: 2026-10-06T23:49:14.022Z
---

# Slang IR layout field keys: getSimpleVal on a global var emits a module-scope load

In `lowerTypeLayout` (slang-lower-to-ir.cpp), the struct-field layout key used to come from `getSimpleVal(ensureDecl(decl))`. For a global variable (Flavor::Ptr, e.g. GLSL `out vec4 f;`), that emits a module-scope `load(%f)` used as the key. The global-scope layout from `createIRModuleForLayout` uses `materialize(...).val` (the var itself), so the element and offset-element layouts of the global parameter group disagreed. Passes that walk only one layout (collectGlobalUniformParameters) miss the load, and `introduceExplicitGlobalContext` (Metal/CPU/CUDA, experimental SPIR-V) then aborts with "no outer func at use site for global" (slang#9078, PR #13467).
Related: on CPU/CUDA, `getVaryingInputRules/OutputRules` return the uniform rules (slang-type-layout.cpp ~2278, ~2545), so GLSL global in/out get *uniform* size in reflection. If they are not collected into GlobalParams, reflection offsets and the emitted struct disagree.
Side effect worth knowing: removing those stray module-scope loads changes the C-like emitters' global declaration order (GLSL/HLSL/WGSL), which can break FileCheck tests that check declaration order.
Env tips: a fresh worktree needs `git submodule update --init --recursive` (`--reference` the shallow base clone fails). clang-format 17 is at /usr/lib/llvm-17/bin (prepend to PATH for extras/formatting.sh). The critique gate hook treats `gh api repos/.../pulls/<n>` reads as PR creation; use mcp__slang-mcp__github_get_pull_request for reads.
