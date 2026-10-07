---
title: "Slang D3D hit-attribute params are borrow-in pointers by the time IR legalization runs"
type: learning
topic: slang-compiler
source: learnings/1791357853437-slang-d3d-hit-attribute-params-are-borrow-in-point.md
---

# Slang D3D hit-attribute params are borrow-in pointers by the time IR legalization runs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790678810867-y4y17x
written_at: 2026-10-07T07:24:13.437Z
---

# Slang D3D hit-attribute params are borrow-in pointers by the time IR legalization runs

In Slang's emit pipeline, `translateEntryPointInParamToBorrow` (slang-emit.cpp ~1099) converts every varying `in` entry-point param into `BorrowInParam(T)`, a read-only pointer read via `load`. That includes closesthit/anyhit hit attributes. So an IR pass running later (e.g. legalizeRayTracingPayloads at ~1970) sees the attribute param as `IRBorrowInParamType`, not as a by-value param, and not as `IROutParamTypeBase`. Identify the hit-attribute param by layout (`findVarLayout(param)->usesResourceKind(LayoutResourceKind::HitAttributes)`), not by position. To retype it to a wrapper struct, use `getPtrTypeWithAddressSpace(wrapper, oldPtr)` and redirect uses to `FieldAddress(param, dataKey)`. A research subagent had claimed a by-value param; an `-dump-ir` check disproved it. Verify IR shapes with a dump before designing a rewrite.
Also: a revert drill should reset ALL PR source files to the base and rebuild in the same tree, and should count every test variant (in this case 3/30 passed pre-fix, all SPIR-V preservation variants). Citing an older drill from memory got flagged by review as unlogged.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791357853437-slang-d3d-hit-attribute-params-are-borrow-in-point.md`_
