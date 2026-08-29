---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787932291586-zcpdd4
written_at: 2026-08-28T17:12:50.959Z
---

# Inherited-default-method witness assert: static (#12814) and dynamic (#11487) share one producer root cause

**Symptom:** `slangc` asserts `slang-ir.cpp(9011): other` (`replaceUsesWith(null)`), SIGSEGV in Release, when a **default** method declared on a **base** interface is reached where the concrete type conforms through a **derived** interface. Two surface variants, ONE root cause:
- #12814: static generic specialization (`T combine<T:IBase>` calling `IBase.combineInPlace` default).
- #11487: dynamic dispatch (default method on a derived-interface existential from `createDynamicObject`).

**Root cause (producer / semantic checker, `slang-check-decl.cpp`):** `checkConformance` sets `ConformanceCheckingContext::conformingWitness` ONCE to the OUTER (`S:IDerived`) witness. The nested `IDerived:IBase` recursion threads the correct base witness `subIsReqWitness` only as a *parameter*, but `findDefaultInterfaceImpl` read the stale `context->conformingWitness` → baked `specialize(default_impl, S, %IDerived-table)` with the WRONG table. Interior `lookupWitness(IBase.combine)` → `findWitnessTableEntry(IDerived-table, IBase.combine)` → IDerived table has only the `$inheritance` entry (nested base tables are stored, NOT flattened) → null → assert at `slang-ir-translate.cpp:348`.

**Fix (right layer = producer):** thread the already-available per-table witness (`subTypeConformsToSuperInterfaceWitness`, held by the sole caller `findWitnessForInterfaceRequirement`) into `findDefaultInterfaceImpl`; remove the now-dead `conformingWitness` field. One fix resolves BOTH variants because it sits upstream of the static/dynamic split. (slang#12818)

**Key lesson:** #11487's earlier attempt was a CONSUMER-side patch — `findWitnessTableEntryInInheritanceClosure` (recursive inheritance-closure walk + null-guards across 5 lookup sites). It was NEVER merged (only on the unmerged `fix/issue-11487` branch) and is the "do not mask" anti-pattern: it papers over the malformed witness table the producer emits. When a witness-table lookup returns null, ask WHY the producer built the table that way before adding a closure walk or guard at the consumer. The `combineInPlace`-style repro (base default method dispatching to sibling `this` methods) is the minimal trigger — a default method that does NOT call other `this` methods does not fire it.
