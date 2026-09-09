---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-08-24T23:44:41.614Z
---

# Slang: free-function forwarder over a new interface breaks [ForwardDerivativeOf] (E31148) — generic overloads tie in derivative resolution

Adding a user-facing free-function forwarder like `[OverloadRank(-10)] T pow<T:IReal>(T x, T y){ return x.pow(y); }` alongside the existing `T pow<T:__BuiltinFloatingPointType>(...)` **breaks the core-module build** with `error[E31148]: cannot resolve derivative function` at the `[ForwardDerivativeOf(pow)]` / `[BackwardDerivativeOf(pow)]` registrations in `diff.meta.slang` (UNARY_DERIVATIVE_IMPL :1863, VECTOR_MATRIX_BINARY_DIFF_IMPL :1677), then `terminate ... Slang::InternalError / Aborted`.

Root cause (traced in slang-check-overload.cpp): `[ForwardDerivativeOf(pow)]` resolves the primal by building `pow(imaginary-args)` and calling `ResolveInvoke`. With two `pow` overloads it must pick one. But:
- `compareOverloadCandidateSpecificity` (~:2214) ties two generics with the SAME specialized-param-count — it does NOT consider constraint tightness (explicit TODO in the code: "does A being applicable imply B" is not implemented; it only counts generic params).
- `CompareOverloadCandidates` (~:2420) then early-returns 0 when either candidate is `Generic`/`UnspecializedGeneric` flavor, BEFORE reaching scope-rank or overload-rank. So `[OverloadRank(-10)]` is IGNORED during derivative-of resolution (it still works for ordinary call-site resolution — that's why the functions compute correctly at call sites, only the registration breaks).
Net: `pow<T:__BFPT>` and `pow<T:IReal>` are indistinguishable to the derivative resolver → ambiguous → E31148. Confirmed: even ONE such forwarder (for any derivative-registered name: pow/exp/sin/cos/tan/log/log2/sqrt/rsqrt/...) triggers it; interfaces+conformances alone build clean.

Fix options: (a) fix `compareOverloadCandidateSpecificity` to prefer the tighter-constrained generic when spec-counts tie (the code's stated intent — but compiler-wide blast radius, maintainer-owned); (b) register derivatives on-primal via `[ForwardDerivative]` instead of name-based `[ForwardDerivativeOf]` (large diff.meta.slang change); (c) don't add the competing free overload — expose the interface op only as a method (`x.pow(y)`), which builds clean. For a draft, (c) + flagging (a)/(b) as the design question is the honest path. Verified against shader-slang/slang @ 2ec76d46ec, #12591.
