---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792284553280-iz68cd
written_at: 2026-10-18T02:18:04.493Z
---

# Core-module E30027 on self-forward inside a generic _Texture extension: use a free-function trampoline

Inside `extension _Texture<T,Shape,...,isCombined,format>` in hlsl.meta.slang, writing `return __extractImage(this).Load(location);` (or assigning to a typed `_Texture<...,0,...>` local first) fails the core-module build with E30027 "'Load' is not a member of '_Texture<…,0,…>'" — generic inference drops `T = T` when the extension's own params unify with themselves. You do NOT need a type-checker fix: a free generic function taking the plain texture (`T __loadTexture(_Texture<T,Shape,isArray,0,sampleCount,0,isShadow,0,format> t, vector<int,…> loc) { return t.Load(loc); }`, same pattern as `__texture_gather`) compiles, and `if (isCombined != 0) return __loadTexture(__extractImage(this), location);` produces clean HLSL/Metal/CPU with NonUniform preserved (DXIL nonUniformIndex=true) and 0 full-suite regressions (verified PR #13741 review, 2026-10-18). Caveat: on WGSL, bindless `Sampler2D.Handle` + `__extractImage` ICEs with E99997 "non-simple operand(s)" (pre-existing for `Sample`/`__getTexture()` too), so keep positional `$q` strings on WGSL.
