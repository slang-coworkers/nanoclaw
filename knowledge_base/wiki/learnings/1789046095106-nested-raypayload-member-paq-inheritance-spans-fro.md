---
title: "Nested [raypayload] member PAQ inheritance spans frontend + IR-legalize + emit (not frontend-only)"
type: learning
topic: slang-compiler
source: learnings/1789046095106-nested-raypayload-member-paq-inheritance-spans-fro.md
---

# Nested [raypayload] member PAQ inheritance spans frontend + IR-legalize + emit (not frontend-only)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789045385703-um1xxb
written_at: 2026-09-10T13:14:55.106Z
---

# Nested [raypayload] member PAQ inheritance spans frontend + IR-legalize + emit (not frontend-only)

**Context:** shader-slang/slang#12991 — a `[raypayload]` struct whose member's TYPE is itself a `[raypayload]` struct is rejected with `error[E40000]` ("field must have 'read' OR 'write' access qualifiers"). Per the DXR PAQ spec + DXC 1.8, such a member must carry NO qualifier and inherits the nested type's field-level PAQs.

**The trap:** The obvious fix is frontend-only — relax `checkRayPayloadStructFields` (`source/slang/slang-check-modifier.cpp:2599-2611`) to skip the read/write requirement for a field whose type carries `RayPayloadAttribute`. **That is insufficient and produces HLSL that DXC rejects.** The DX SM6.7+ pass `legalizeRayPayloadAccessQualifiersForHLSL` → `addDefaultPayloadAccessQualifiersToField/Struct` (`source/slang/slang-ir-hlsl-legalize.cpp:92-131`) iterates ALL fields of every `IRRayPayloadDecoration` struct with NO type check and injects default `read/write(caller,anyhit,closesthit,miss)`; `emitSemanticsImpl` (`source/slang/slang-emit-hlsl.cpp:2265-2271`) then emits `NestedPayload nested : read(...) : write(...)` on the outer member — which DXC rejects for a struct-typed member.

**Correct fix (3 sites):** exempt a field whose type is itself a payload struct in (1) the frontend check, (2) the legalize default-fill, and (3) defensively the emitter. Each payload struct is an INDEPENDENT `IRStructType`/StructDecl with its own decoration (no outer/nested link encoded — `slang-lower-to-ir.cpp:12850`), so the nested struct's own fields are still validated/filled correctly on their own.

**Reusable predicate to add:** none exists today. AST: resolve field type → DeclRefType → StructDecl → `findModifier<RayPayloadAttribute>()` (or `isDeclRefTypeOf`). IR: `structType->findDecoration<IRRayPayloadDecoration>()`.

**General lesson:** for any "relax a frontend validation" fix on a target-specific feature, check the downstream legalization/emit passes — they often re-assert the same invariant the frontend was enforcing, so the fix must be threaded through every layer that assumes it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789046095106-nested-raypayload-member-paq-inheritance-spans-fro.md`_
