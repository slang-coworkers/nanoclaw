---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787988335200-ak9m3g
written_at: 2026-09-01T04:12:19.874Z
---

# [approver/challenger-miss] before BLOCKing on an emit null-deref, prove the emit site is REACHED (lowerExistentials strips non-COM interfaces)

## Symptom
shader-slang/slang#12819. R1 (@6335e009) I recorded BLOCK (RED_BUG:slang-emit-cpp.cpp:843) —
endorsing the primary review's 🔴 that the PR's new null-valued equality-constraint
IRInterfaceRequirementEntry would null-deref at `emitInterface`'s unguarded
`entry->getRequirementVal()->getOp()` on `-target cpp/cuda`. R2 (@4bb6e85635b0) the author added a
`-target cpp` test driving a dynamic `IScalar` existential; CI stayed green, the production review
flipped to ✅ Clean, a human MEMBER approved, and DECISION_REVIEW forced me to correct the
mechanism. Net: **R1 was a FALSE BLOCK** — the crash was never reachable.

## Root cause
Both the R1 review and I asserted REACHABILITY of the `:843` raw-deref without proving the emit site
is actually reached for an ordinary interface. It is not: on the C-family (cpp/cuda) emit path,
`slang-emit.cpp:1737` runs `SLANG_PASS(lowerExistentials, ...)` BEFORE source emission.
`lowerExistentials::processModule` (`slang-ir-lower-dynamic-dispatch-insts.cpp:2043-2075`, comment
:2045-2048) rewrites every remaining non-COM / non-Builtin `IRInterfaceType` into
`TupleType(RTTI, witnessTableID, AnyValue)`; internal existential uses are already tagged-unions,
and a SINGLETON conformance collapses straight to the concrete type (`:1426`). So an ordinary
interface like `IScalar` NEVER reaches `CPPSourceEmitter::emitInterface`'s struct body
(`slang-emit-cpp.cpp:804-851`, incl. the `:843` deref). That body is effectively dead for ordinary
interfaces; COM interfaces return earlier via `emitComInterface` (`:800-801`). The null value was
also already present pre-PR (`getInterfaceRequirementKey` → `createStructKey()` has a null type →
the old `else` `specializeWithOuterGeneric(null) = null`), so it was never a regression either.

## How to catch it (the transferable probe)
When a review (or you) flags "producer P now makes value V null and consumer C raw-derefs V →
crash", a BLOCK requires proving C is REACHED with that shape on the target — the mirror of "could
the negative come out otherwise?" applied to a positive crash claim:
1. Grep the emit pipeline for a lowering pass that REMOVES/rewrites the type before C runs. For
   C-family interface emit specifically: `lowerExistentials` (slang-emit.cpp) rewrites non-COM
   `IRInterfaceType` into a tuple before emission ⇒ `emitInterface`'s struct body is dead for
   ordinary interfaces. Only COM/builtin interfaces survive, and those take a different branch.
2. A green CI test that "exercises the path" is NOT proof the crash site runs — the type may be
   lowered away first (the cpp test here validates linking/typeflow, not the `:843` branch). Don't
   label such a test a "trigger-present control" for the emit branch; it can't be.
3. Severity discipline: a crash claim that can't survive a reachability check is at most ABSTAIN
   (OPEN_GAP / "a human should confirm reachability"), NOT BLOCK. BLOCK asserts a VERIFIED bug;
   "the code raw-derefs and the value can be null" is only half — the other half is reachability.

## Fix
Corrected the R2 decision to WOULD_APPROVE via the accurate mechanism (unreachable). For future
emit-consumer null-deref concerns, run the reachability grep (lowering passes that strip the type)
BEFORE recording BLOCK; if reachability is uncertain, ABSTAIN, don't BLOCK. This sharpens Step-0
recall for any PR touching interface/emit consumers.

## Process note
codex DECISION_REVIEW caught my "createDynamicObject forces emitInterface, so the cpp test is a
trigger-present control for :843" claim — wrong in the opposite direction from R1. I verified codex's
lowerExistentials mechanism against source (slang-emit.cpp:1737; slang-ir-lower-dynamic-dispatch-insts.cpp:2043-2075,:1426) before rewriting, rather than accepting by analogy.
