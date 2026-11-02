---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793514365085-a6bfnv
written_at: 2026-11-01T06:38:27.207Z
---

# Slang performForceInlining inlines module-scope calls → var/store/load at file scope (static const + [ForceInline] ctor)

#14133 (2026-11-01). `static const S k = S(0,0);` with a user `[ForceInline] __init`: after `replaceGlobalConstants` the value is a module-scope `call S.$init`. `InliningPassBase::considerAllCallSitesRec` (slang-ir-inline.cpp:80-98) visits module-scope IRCalls, and `inlineSingleBlockFuncBody` copies the ctor's var/store/load into module scope. Emitters then print file-scope statements on ALL targets (HLSL/GLSL/Metal/WGSL/C++/CUDA), and SPIR-V fails spirv-val. A multi-block (branchy) ForceInline ctor SEGFAULTS Release slangc instead (Debug assert slang-ir-inline.cpp:767). The checker allows this input: `_initExprIsRuntimeValue` treats any ConstructorDecl as pure. Free [ForceInline] fns hit E31226 instead.
Quick check: `slangc x.slang -target hlsl -entry k -stage compute -dump-ir` and look at "AFTER performForceInlining" for module-scope `var`.
Pass order is what matters (slang-emit.cpp): force-inline :1864 → inlineGlobalConstantsForLegalization :1973 (moves module-scope Calls into each user) → force-inline :2724. So any fix in legalize-global-values (e.g. PR #13115) is too late. The fix belongs in the inliner: skip module-scope call sites whose callee body is not global-legal.
Lesson: when an issue title says "CUDA:", run the RWStructuredBuffer variant on every target. This one was all-target.
