---
title: "Uninit-checker: storing an ADDRESS isn't a read; and run the FULL suite for broad-blast-radius frontend changes"
type: learning
topic: misc
source: learnings/1782448931140-uninit-checker-storing-an-address-isn-t-a-read-and.md
---

# Uninit-checker: storing an ADDRESS isn't a read; and run the FULL suite for broad-blast-radius frontend changes

Two lessons from slang#11763 / PR #11764, where peer review reached APPROVE but full-suite CI then caught a false positive.

TECHNICAL — uninitialized-use checker (`getInstructionUsageType` in slang-ir-use-uninitialized-values.cpp). If you give the store family (`Store`/`AtomicStore`/`SwizzledStore`/`MatrixSwizzleStore`) an operand-role split so the VALUE operand (operand 1) counts as a read (`Load`), you MUST exclude pointer-typed value operands: `inst == user->getOperand(1) && !as<IRPtrTypeBase>(inst->getDataType())`. Reason: `self.self = &self;` lowers to `store(getFieldAddr(self), self)` where operand 1 is the `self` IRVar — a `Ptr(...)` ADDRESS. Storing an address does not read the pointed-to (uninitialized) memory, so flagging it is a spurious E41016. The function's `default` case already uses this exact pointer-vs-value rule (pointer→Store, else→Load), so reusing it is consistent. Key on `inst->getDataType()` (the tracked operand), not the user — `Store` itself is void-typed. Accepted edge: a loaded pointer VALUE copy (`T* p; q=p;`) then won't warn, matching the default case (conservative: a missed warning, never a spurious one).

PROCESS — for any change to a SHARED frontend pass with broad blast radius (uninit checker, IR lowering, name emission, a classifier used across all targets), a green sweep of just the directory you added your test in is NOT sufficient proof, and neither is a green peer review. The regression here was in `tests/bugs/llvm-debug-data-recursion.slang` while my pre-push sweep only ran `tests/diagnostics/` (601/601 green). Run the FULL `tests/` (or at minimum every dir the change can reach: tests/bugs/, tests/diagnostics/, tests/language-feature/, tests/compute/ …) BEFORE pushing/declaring done. The CPU box can run `-llvm`/`-cpu`/diagnostic tests locally; GPU tests are ignored but the frontend-diagnostic ones (which is where over-warning bites) run fine. Webhook-driven CI eventually catches it, but a wasted CI cycle + a premature peer APPROVE are avoidable by sweeping broadly up front.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782448931140-uninit-checker-storing-an-address-isn-t-a-read-and.md`_
