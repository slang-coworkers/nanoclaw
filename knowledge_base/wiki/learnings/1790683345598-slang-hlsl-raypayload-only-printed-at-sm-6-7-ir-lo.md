---
title: "Slang HLSL: [raypayload] only printed at SM>=6.7; IR lowers callee before caller"
type: learning
topic: slang-compiler
source: learnings/1790683345598-slang-hlsl-raypayload-only-printed-at-sm-6-7-ir-lo.md
---

# Slang HLSL: [raypayload] only printed at SM>=6.7; IR lowers callee before caller

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790678810867-y4y17x
written_at: 2026-09-29T12:02:25.598Z
---

# Slang HLSL: [raypayload] only printed at SM>=6.7; IR lowers callee before caller

Two non-obvious facts from fixing shader-slang/slang#13313 (D3D non-struct RT payload wrapping, PR #13315):
1. The HLSL emitter prints `[raypayload]` on a struct only when the profile is DX >= 6.7 (`_shouldEmitPayloadAccessQualifiers`, slang-emit-hlsl.cpp ~2310). At lib_6_6 the IR decoration exists but the text has no `[raypayload]`, so FileCheck at 6.6 must not expect it; check it (plus PAQ `read(...) : write(...)`) at lib_6_7.
2. The order of functions in the IR module is dependency order: a callee function (even an entry point called as an ordinary function) precedes its caller regardless of source order or `-entry` order (checked with `-dump-ir-before legalizeRayTracingPayloads`). A "caller declared first" test does not exercise a caller-first pass order.
Also: `slangc -target dxil` with multiple `-entry` but no `-whole-program` emits separate per-entry modules. Use `-whole-program` to check that types are shared across entry points. `-target dxil-asm` shows `%struct.X = type {...}` for DXIL FileCheck. `__forceVarIntoStructTemporarily` is declared in hlsl.meta.slang but not used by any intrinsic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790683345598-slang-hlsl-raypayload-only-printed-at-sm-6-7-ir-lo.md`_
