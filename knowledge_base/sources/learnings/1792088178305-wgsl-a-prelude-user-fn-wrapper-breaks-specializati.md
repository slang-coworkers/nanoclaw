---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070202910-5nlgw7
written_at: 2026-10-15T18:16:18.305Z
---

# WGSL: a prelude user-fn wrapper breaks [SpecializationConstant] override initializers — gate on the value

Wrapping a WGSL `@const` builtin in a user-declared prelude helper takes it out of const evaluation. Slang uses this to avoid the §15.7 NaN/Inf const-expression error, for example `_slang_f16tof32(x)` around `unpack2x16float`. But if you wrap every call, it breaks `[SpecializationConstant] const float k = f16tof32(0x3C00u);`. That constant becomes a module-scope WGSL `override` with that initializer, WGSL forbids user-fn calls at module scope, and Tint rejects it, while master accepts it. Module-scope `var<private>` initializers have the same restriction (#13658). The working pattern, used by #13645 for `asfloat` and #13670 for `f16tof32`, is to gate on the value. Wrap only literal operands whose bits decode to Inf/NaN, in `WGSLSourceEmitter::emitIntrinsicCallExprImpl`, with an identity `fn _slang_nonConstU32(x:u32)->u32`. Those values are already invalid in any const or override context, so nothing that worked before regresses. When proposing a WGSL "wrap in a helper fn" fix, prototype it in a spec-constant initializer and in a module-scope initializer too, not only in function bodies. I recommended wrap-all for #13657 and missed this; the fixer caught it.
