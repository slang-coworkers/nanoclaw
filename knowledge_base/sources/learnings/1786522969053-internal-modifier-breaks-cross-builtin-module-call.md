---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786519367495-72kxea
written_at: 2026-08-12T08:22:49.053Z
---

# internal modifier breaks cross-builtin-module calls — GLSL is a separate module from Core

When triaging a user-callable core-module builtin that ICEs at emit (shader-slang/slang#12493, `__getLegalizedSPIRVGlobalParamAddr`), the obvious "mark it `internal`" fix can BREAK THE CORE-MODULE BUILD — verify it before recommending.

WHY: `internal` = `DeclVisibility::Internal` = visible only within the SAME module (`isDeclVisibleFromScope`, slang-check-expr.cpp:1149-1154: `getModuleDecl(decl) == getModuleDecl(scope)`). The builtin modules are NOT one module: the Core builtin module = `core.meta.slang` + `hlsl.meta.slang` + `diff.meta.slang` concatenated, while **GLSL is a SEPARATE builtin module** (`getBuiltinModuleSource`/`compileBuiltinModule`, slang-global-session.cpp:391-398; separate language scopes `coreLanguageScope`/`glslLanguageScope` at :100-110). So a decl in `core.meta.slang` marked `internal` becomes INVISIBLE to any call site in `glsl.meta.slang`.

MEASURED: adding `internal` to `__getLegalizedSPIRVGlobalParamAddr` (called from 8 `case spirv:` arms in glsl.meta.slang) → core-module rebuild FAILS with 360× `error[E30600]: declaration not accessible` at exactly those call sites.

The `__frem`/`__irem` counterexample (both `internal`, callable from user code) does NOT prove `internal` is user-facing-safe here: they are NEVER referenced cross-module — they back the `%` operator via a member `.mod()` and a builtin-arithmetic fast path (convertToBuiltinArithmeticOp, slang-check-expr.cpp:4686) that bypasses name lookup. A builtin CALLED BY NAME from a different builtin module is the case `internal` breaks.

WORKING ALTERNATIVES (also measured): (a) `[require(spirv)]` on the declaration builds clean and rejects non-spirv user calls at CHECK time with E36107 — but a user TARGETING spirv still reaches the spirv-emit ICE (the gate is satisfied), so it is necessary-not-sufficient and must be paired with an emit-side/user-call-shape diagnostic; (b) move the declaration into `glsl.meta.slang` next to its only callers — the precedent is `__imageTexelPointer` (the peer intrinsic in the same spirv arm), which IS declared in glsl.meta.slang.

GENERAL RULE: before recommending a visibility/gating fix for a core-module builtin, check whether it is referenced from ANOTHER builtin module (`grep glsl.meta.slang`) — if so, `internal` is wrong; and MEASURE the fix with a core-module rebuild (cmake -E touch core.meta.slang → generate_core_module_headers → slangc), because the effect is a build-time visibility failure invisible to source reading.
