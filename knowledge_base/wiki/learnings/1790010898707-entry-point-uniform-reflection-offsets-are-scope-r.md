---
title: "Entry-point uniform reflection offsets are scope-relative; isParameterLocationUsed needs absolute — no binding 'bloat'"
type: learning
topic: slang-compiler
source: learnings/1790010898707-entry-point-uniform-reflection-offsets-are-scope-r.md
superseded_by: 1790016065362-correction-entry-point-uniform-binding-bloat-acros
---

# Entry-point uniform reflection offsets are scope-relative; isParameterLocationUsed needs absolute — no binding "bloat"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790010356260-j7u8a8
written_at: 2026-09-21T17:14:58.707Z
---

# Entry-point uniform reflection offsets are scope-relative; isParameterLocationUsed needs absolute — no binding "bloat"

**Class of user confusion (triage #13203, not-a-bug):** "Two compute entry points with `uniform` params report the same binding indices, `isParameterLocationUsed` says the 2nd entry point's params are unused, and Slang is 'bloating' binding indices."

**Ground truth (source + DeepWiki + GPU-free repro):**
- A leaf entry-point `uniform` parameter's `getBindingIndex()` / `getOffset(category)` is **relative to that entry point's own scope** — each entry point numbers its params from 0 (`collectEntryPointParameters` builds a fresh `SimpleScopeLayoutBuilder`, slang-parameter-binding.cpp:3358/3482). So both entry points legitimately report the same relative offsets.
- The per-entry-point global offset is assigned later in the completion pass (`CompleteBindingsVisitor::visitEntryPoint` → `completeBindingsForParameterImpl`); the 2nd entry point's scope var-layout carries a nonzero offset.
- `isParameterLocationUsed` / `spIsParameterLocationUsed` (slang-reflection-api.cpp:5138; header slang.h:4775-4779) takes the **ABSOLUTE** location. Absolute = leaf relative offset + every enclosing scope offset, **including** `EntryPointReflection::getVarLayout()->getOffset(category)`. 1st EP has scope offset 0 (relative==absolute → works); 2nd EP's is nonzero (relative misses → reports unused). Adding the scope offset = the documented `calculateCumulativeOffset` recipe (docs/user-guide/09-reflection.md:1272/1476/1595-1630; recommends `getVarLayout()` at :1109).
- **There is NO binding bloat.** Verified by emit: each technique compiled as its own pipeline emits identical bindings — HLSL `b0/t0/u0`, SPIR-V `binding 0/1/2 set 0` — genuine reuse, exactly as docs/user-guide/02-conventional-features.md:848-849 promises ("localUniform2 can reuse the same binding location"). The nonzero 2nd-EP offset is only how a single whole-program reflection tree numbers the two entry points to avoid collision within that combined view; it is not a runtime cost.
- Prefer category-qualified `getOffset(category)`/`getBindingSpace(category)` over `getBindingIndex()` (no category overload, slang-reflection-api.cpp:3362 — can't disambiguate multi-category params; a likely cause of surprising index values).

**Triage disposition:** not-a-bug/question → answer with the relative→absolute model + doc pointers, add `reflection` label, NO `reproduced` (by-design, not a defect), leave Type blank, no fixer. Verify GPU-free with `slangc -reflection-json` (relative indices) + `-target hlsl/spirv-asm -entry X` per entry point (identical emitted bindings prove no bloat).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790010898707-entry-point-uniform-reflection-offsets-are-scope-r.md`_
