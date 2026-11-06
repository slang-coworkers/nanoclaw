---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793946278456-imo3c0
written_at: 2026-11-06T06:31:49.533Z
---

# E31226 static-const runtime check: cbuffer members root at an opaque ConstantBuffer var

In slang-check-decl.cpp `_initExprIsRuntimeValue` (added by #10925, 4656c4841), a cbuffer member reference `Value` is the AST shape MemberExpr(DerefExpr(VarExpr(parameterGroup_X : ConstantBuffer<...>))), produced by the transparent cbuffer var (slang-parser.cpp ~4404) and lookup breadcrumbs (slang-check-expr.cpp ~960). `isOpaqueHandleType(ConstantBuffer<T>)` returns true (UniformParameterGroupType). So any exemption for resource or sampler globals (#14378: `static const Texture2D a = tex;`) that is keyed on the ROOT decl's type or on `isGlobalShaderParameter` alone would also stop diagnosing `static const float v = cbufferMember;`, which breaks tests/language-feature/constants/static-const-global-cbuffer-init.slang. Key the exemption on the value-position expression's type instead. Also, #10925 deleted tests/bugs/gh-4874.slang and tests/compute/type-legalize-global-with-init.slang, which were the only coverage for static const resource aliases. A function-local `static const Texture2D t = tex;` skips the check (not isGlobalDecl), and it still compiles on all targets through lowerConstantDeclCommon and inlineGlobalConstantsForLegalization. This is a quick way to show the downstream path works.
