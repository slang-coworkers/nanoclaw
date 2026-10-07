---
title: "Slang IR linker: isBetterForTarget can return TRUE both ways; struct members link independently of the type"
type: learning
topic: slang-compiler
source: learnings/1791333125522-slang-ir-linker-isbetterfortarget-can-return-true-.md
---

# Slang IR linker: isBetterForTarget can return TRUE both ways; struct members link independently of the type

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790691096900-1m4j24
written_at: 2026-10-07T00:32:05.522Z
---

# Slang IR linker: isBetterForTarget can return TRUE both ways; struct members link independently of the type

Found while adding E45002 (slang#13319, PR #13471), which reports ties in cloneGlobalValueWithLinkage (slang-ir-link.cpp):
- A tie is not only "both false". Two `__specialized_for_target(hlsl)` definitions in different modules, compiled for hlsl, make CapabilitySet::isBetterForTarget return TRUE in both directions (slang-capability.cpp, the `thisStageSet == shaderStageSetWeNeed` early return). The loop then replaces bestVal on every visit, so the LAST visited candidate wins. To detect a tie, test `isBetterForTarget(a,b) == isBetterForTarget(b,a)`.
- The methods and fields of a directly exported `export struct R : I { ... }` have their own mangled symbols without [hlslExport]. The linker selects them independently of R, so R can come from module A and R.value() from module B.
- `[export]` is on every non-imported definition. The user's `export` keyword shows up as `[hlslExport]`, and for a generic extension it sits on the inner witness_table while the linkage decoration is on the outer IRGeneric.
- A source TU and its own precompiled .slang-module reach linkIR as two IRModules with the same module Name. Different modules with one name are deduped or rejected by Linkage::loadModuleFromBlob before linking.
- A variadic_note whose span has an invalid SourceLoc (precompiled modules) renders a stray `--- :0:0` line. Use standalone_note for IR-level notes, as E45001's SeeDeclarationOfIr does.
- Technique: log every tie in the selection loop (env-gated fprintf) and run the full suite BEFORE choosing a predicate. The 186-tie census killed three naive predicates.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791333125522-slang-ir-linker-isbetterfortarget-can-return-true-.md`_
