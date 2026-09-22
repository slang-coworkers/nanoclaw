---
title: "Reviewer reuse-nit trap: check the local's STATIC type before suggesting an accessor swap (IRInst* vs IRFunc*)"
type: learning
topic: review-process
source: learnings/1789990436303-reviewer-reuse-nit-trap-check-the-local-s-static-t.md
---

# Reviewer reuse-nit trap: check the local's STATIC type before suggesting an accessor swap (IRInst* vs IRFunc*)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789985222851-qj2ccb
written_at: 2026-09-21T11:33:56.303Z
---

# Reviewer reuse-nit trap: check the local's STATIC type before suggesting an accessor swap (IRInst* vs IRFunc*)

From round-2 review of shader-slang/slang#13195 (geometry topology fix).

**Trap:** An automated correctness reviewer (nv-slang-bot / claude-code-action pipeline) flagged a new param-walk loop in `lowerFuncDeclInContext` (`slang-lower-to-ir.cpp`) as reimplementing `IRFunc::getParams()`/`getFirstParam()` and suggested `for (auto pp : irFunc->getParams())`, dropping the outer `firstBlock &&` guard. It even "verified" that `getParams()`/`getFirstParam()` exist on `IRGlobalValueWithParams` (`slang-ir.cpp:804-829`) and that `IRFunc` derives from it. All true — but the suggestion does NOT compile.

**Why:** In `lowerFuncDeclInContext` the local is declared `IRInst* irFunc = subBuilder->createFunc();` (slang-lower-to-ir.cpp:14182) and later reassigned to a synthesized op (`irFunc = synthOp;` ~:14262). Its **static** type is `IRInst*`, not `IRFunc*`. `getParams()`/`getFirstParam()` are members of `IRGlobalValueWithParams`, so they're unreachable without a cast; only `getFirstBlock()` (defined on `IRInst`) is callable — which is exactly why the hand-written loop uses `getFirstBlock()->getFirstParam()`/`getNextParam()`.

**Lesson for reviewers (and for me when adjudicating a reviewer finding):** before endorsing a "reuse this accessor" simplification, confirm the receiver variable's *declared/static* type at the call site, not just that the method exists on the dynamic/most-derived class. Confirming "method exists on class X and the object is-a X dynamically" is necessary but NOT sufficient — the local may be typed as a base. This is a recurring false-positive shape for automated reuse/simplification nits. When a fixer declines such a nit with a typing justification, verify the declaration line from source (cheap) rather than rubber-stamping.

Also: the correct disposition for the paired invariant concern (a first-match `break` assuming a single input-primitive param) was a comment stating the invariant, NOT a redundant assert — because the sibling glsl-legalize consistency `SLANG_ASSERT` already catches a disagreeing second param. Don't pile a second assert at the producer when a downstream one already guards the same invariant.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789990436303-reviewer-reuse-nit-trap-check-the-local-s-static-t.md`_
