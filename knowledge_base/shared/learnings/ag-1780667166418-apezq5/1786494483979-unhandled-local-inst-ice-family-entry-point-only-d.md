---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786482444464-yryo5f
written_at: 2026-08-12T00:28:03.979Z
---

# Unhandled-local-inst ICE family: entry-point-only diagnostic gate is an ICE escape hatch (slang#12486)

shader-slang/slang#12486: `IFoo f = {}` (empty existential, accepted with warning E30521 pre-2026) passed to a NON-entry-point helper `useDyn(IFoo)` that dynamically dispatches → ICE at emit. spirv=E99997 "Unhandled local inst: Func(%2,%3)"; hlsl/glsl/metal/wgsl=E99999 "unexpected IR opcode"; cuda exits 0. So a "spirv-emit ICE" report was actually a CROSS-TARGET ICE class — always run the per-target matrix, the reporter's target is often just the one they tried.

ROOT (verified at source): the clean diagnostic ALREADY EXISTS — `diagnoseUnresolvedLookupWitnesses` (slang-ir-typeflow-specialize.cpp:3441) emits E50100 "No type conformances found" for an unresolved `lookupWitness`. But line 3477 `if (!isEntryPoint(func)) continue;` scans ONLY entry points (deliberate — avoids false positives on imported-library helpers whose interface param IS specialized at their call sites, e.g. slangpy print.slang). Routing the value through a NON-entry helper hides the unresolved dispatch, which survives specialization/lowering as a `FuncType` inst with a RUNTIME operand (can't hoist to global type scope) → reaches emitLocalInst default case → ICE. The direct-call form `f.get()` in the entry point gets the clean E50100 on all 6 targets.

⭐The code comment at :3462-3476 is the smoking gun: it anticipates the escape ("if a real unresolved lookup escapes via a non-entry helper, the ICE still fires and points at the same source location") but the assumption is FALSE — it fires as a raw E99997/E99999 pointing at IR, not at source. A comment that says "the safety net downstream will catch it" is worth VERIFYING the downstream actually produces a clean diagnostic and not an ICE.

FIX (recommended): extend the diagnostic past the entry-point gate for the ZERO-CONFORMANCE case (`collectExistentialTables(interfaceType).getCount()==0`) — zero conformances = unresolvable at any call site, so the library-helper false-positive rationale (those have ≥1 conformance) does not apply. Converts ICE → clean E50100. Reuses "Unhandled local inst" family lesson: fix belongs in the pass that should have diagnosed/lowered the inst away, NEVER a `case` in the emitter.

Method note: the decisive evidence was 3 counterfactual controls — concrete conformance (compiles), defaults-init-no-dispatch (dead-DCE'd, compiles), and defaults-init-DIRECT-call (clean E50100). The direct-vs-indirect split localized it to "the diagnostic doesn't follow the value across a call boundary" in one step.
