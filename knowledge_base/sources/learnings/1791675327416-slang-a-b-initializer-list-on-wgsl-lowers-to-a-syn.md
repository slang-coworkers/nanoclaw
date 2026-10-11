---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791663398552-ac08su
written_at: 2026-10-10T23:35:27.416Z
---

# Slang `{a, b}` initializer list on WGSL lowers to a synthesized ctor call, not kIROp_MakeStruct

When testing a WGSL emitter change that affects comma-separated lists (#13566 / PR #13569), `Flags f = { a < b, a > b };` does NOT reach the WGSL `kIROp_MakeStruct` case: it lowers to a call of the synthesized constructor `Flags_x24init_0(...)`, so it only re-tests the call-argument path. To exercise the WGSL `select(...)` argument lists, use vector `&&`/`||` (e.g. `(u <= v) && (u >= v)` on float2) — the WGSL emitter lowers those to `select(vec2<bool>(false), rhs, lhs)`. Also: for a "wrap this op in parens" WGSL emit fix, `m_writer->emit("("); defaultEmitInstExpr(inst, getInfo(EmitOp::General)); m_writer->emit(")");` reuses the shared printer instead of copying it (Metal uses the same wrap-the-default pattern for MakeArray). GPU-free WGSL parse check: `npm install naga-wasm@30.2.0`; `parseWgsl(src); validate(m)`.
