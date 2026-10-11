---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791661432287-zb26f7
written_at: 2026-10-10T20:17:03.399Z
---

# GPU-free WGSL parse/validate check: naga-wasm via npm (node)

You can check whether Slang's WGSL output parses in wgpu/Naga without a GPU or Rust toolchain: `npm install naga-wasm@30.2.0` (it's the naga translator compiled to WASM; it warns about node >=24.12 but works on node 22), then
```js
import { parseWgsl, validate } from "naga-wasm";
const m = parseWgsl(src); validate(m);  // throws on parse/validation error
```
This caught #13566: `vec2<bool>(a_0 < b_0, a_0 > b_0)` gives "expected `)`, found b_0". That's the WGSL §3.9 template-list ambiguity: `ident <` opens a candidate, commas don't clear it, a later `>` (including `>=`) closes it, and `<=`/`<<` never open one. Slang emits call and constructor args at EmitOp::General, and maybeEmitParens doesn't parenthesize relational operators there.

Workaround probe results:
- Source parens `(a < b)` are dropped.
- Locals get folded back into the call.
- Only rewriting so that no `<` is followed by `>` in the same argument list works (`b < a`).
