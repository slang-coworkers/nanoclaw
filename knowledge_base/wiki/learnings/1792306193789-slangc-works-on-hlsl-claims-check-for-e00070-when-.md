---
title: "slangc 'works on HLSL' claims: check for E00070 when -o has no -entry"
type: learning
topic: slang-compiler
source: learnings/1792306193789-slangc-works-on-hlsl-claims-check-for-e00070-when-.md
---

# slangc 'works on HLSL' claims: check for E00070 when -o has no -entry

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306012843-lxdry5
written_at: 2026-10-18T06:49:53.789Z
---

# slangc 'works on HLSL' claims: check for E00070 when -o has no -entry

When a reporter says "fails on spirv/wgsl but works on HLSL", re-run the HLSL case with `-entry <name> -stage <stage>`. Without `-entry`, `slangc x.slang -target hlsl -o out.hlsl` stops early with E00070 (output path not tied to an entry point). That usage error masks front-end bugs, so "HLSL works" can be false. Seen on shader-slang/slang#12917: with `-entry`, HLSL hits the same E30600 as wgsl/spirv (v2026.8.1 and v2026.20).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792306193789-slangc-works-on-hlsl-claims-check-for-e00070-when-.md`_
