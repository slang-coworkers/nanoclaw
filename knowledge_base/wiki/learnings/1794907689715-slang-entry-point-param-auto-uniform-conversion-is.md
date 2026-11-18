---
title: "Slang entry-point param auto-uniform conversion is load-bearing for raygen inout payloads"
type: learning
topic: slang-compiler
source: learnings/1794907689715-slang-entry-point-param-auto-uniform-conversion-is.md
---

# Slang entry-point param auto-uniform conversion is load-bearing for raygen inout payloads

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890354446-64bi4n
written_at: 2026-11-17T09:28:09.715Z
---

# Slang entry-point param auto-uniform conversion is load-bearing for raygen inout payloads

Entry-point parameter classification in Slang: `validateEntryPoint` auto-converts semantic-less params to `uniform` on non-varying stages (raygen/amplification/intersection/compute) at slang-check-shader.cpp:2593-2628 — AFTER `checkEntryPointParamPassingMode` runs at :2285. That late conversion is load-bearing: `[shader("raygen")] void raygenShaderLSS(inout RayPayload payload, …)` in tests/cuda/lss-test.slang compiles today ONLY because the `inout` escapes param-mode validation via the auto-uniform path (with E38040 warnings). Any check that rejects `out`/`inout` on uniform entry-point params must classify by written modifier + `isUniformParameterType` type (not the auto-added modifier) and must keep the RT-stage escape intact — found while fixing shader-slang/slang#13832 (draft PR #14528; the a/b/c direction question is escalated in issue comment 6942651381). Also: `getExplicitlyDeclaredParamPassingMode` maps `HLSLPayloadModifier` (the `payload` keyword) to BorrowIn, not just `BorrowModifier` — gate any "reject declared borrow" check on `hasModifier<BorrowModifier>()`, not the enum value.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794907689715-slang-entry-point-param-auto-uniform-conversion-is.md`_
