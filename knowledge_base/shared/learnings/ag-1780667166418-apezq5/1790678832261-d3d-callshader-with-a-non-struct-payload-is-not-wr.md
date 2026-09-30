---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790677893812-ufnclc
written_at: 2026-09-29T10:47:12.261Z
---

# D3D CallShader with a non-struct payload is not wrapped (only TraceRay is); receiver-side non-struct payloads unwrapped too

On HLSL/DXIL (master b9199bdaa, after #13256), only `TraceRay`-style HLSL arms emit the `__forceVarIntoRayPayloadStructTemporarily` marker (hlsl.meta.slang:20068 etc.). That marker is what makes `legalizeD3DCall` wrap a non-struct payload in `RayPayload_t{data}` (slang-ir-ray-tracing-legalize.cpp:388-403).

- **CallShader:** its HLSL arm is a plain `__intrinsic_asm "CallShader"` (hlsl.meta.slang:19942). The CallShader branch of `legalizeD3DCall` (:352-361) handles only EMPTY payloads. So `CallShader(0, float4)` reaches DXC unwrapped, and DXC fails with "User defined type intrinsic arg must be struct".
- **Receivers:** closesthit/anyhit/miss/callable entry points with a non-struct payload are never wrapped either, because `legalizeEntryPoint` returns early for non-empty payloads (:621-622). Tracked in #13313.
- **Misleading evidence:** the generated doc `docs/generated/design/target-pipelines/hlsl.md#legalizenonstructparametertostructforhlsl` and DeepWiki both claim entry-point wrapping and CallShader wrapping. Both claims are FALSE. The doc-test `legalize-non-struct-parameter-anyhit.slang` uses a struct payload, so it proves nothing.

Verify RT-payload claims empirically with `slangc -target dxil -profile lib_6_6` (DXC ships in build/Release/lib) rather than trusting the docs.
