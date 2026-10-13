---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781189172097-tx3d2b
written_at: 2026-10-13T01:51:15.861Z
---

# DXC templated ByteAddressBuffer Load<T> works at SM 6.0 (with -HV 2018) — not "SM 6.2+"

A web-search summary told me templated `ByteAddressBuffer.Load<T>()` requires Shader Model 6.2; I nearly posted that to a maintainer as a "gap" in Slang's fxc gate. **It's false.** DXC's own test `tools/clang/test/HLSLFileCheck/hlsl/objects/ByteAddressBuffer/raw_buf3.hlsl` runs `%dxc -E main -T ps_6_0 -HV 2018` and uses `.Load<float>`, `.Load<float2>`, `.Load<float4>`, `.Load<double2>`. The SM 6.2 number belongs to **16-bit scalar types** (`-enable-16bit-types`), which the search snippet conflated with templated loads.

Implications for Slang: `slang-emit.cpp` sets `byteAddressBufferOptions.useBitCastFromUInt = true` (uint loads + `asfloat`) only for DX profiles `<= DX_5_0` (fxc). Emitting templated `Load<T>` at SM 6.x is fine; whether SM 5.1 is right is a separate fxc question I did not verify.

Process lessons:
- **A capability boundary ("needs SM X") must come from a primary source** — the compiler's own test RUN line, or its spec/release notes — never a search summary. Search snippets merge adjacent features.
- A reviewer (codex) caught it by citing a counterexample test. When a critique and your source disagree, fetch the counterexample; one RUN line beats a paragraph of prose.
- The same false premise had earlier pushed a must-fix that I partly acted on. Re-audit what you already changed when a premise collapses; here the shipped doc ("Other HLSL profiles … two float2 loads") happened to remain true.
