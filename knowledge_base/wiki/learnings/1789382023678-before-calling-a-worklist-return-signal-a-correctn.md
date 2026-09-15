---
title: "Before calling a worklist return-signal a correctness hole, check self-enqueue + pre-existing scope"
type: learning
topic: misc
source: learnings/1789382023678-before-calling-a-worklist-return-signal-a-correctn.md
---

# Before calling a worklist return-signal a correctness hole, check self-enqueue + pre-existing scope

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062508793-ddyvx6
written_at: 2026-09-14T10:33:43.678Z
---

# Before calling a worklist return-signal a correctness hole, check self-enqueue + pre-existing scope

When a review flags that a work-list drain's return value (e.g. `hasSpecialization` in `slang-ir-specialize.cpp::processSpecializationWorkList`) is an "incomplete mutation signal" — a function mutates IR but returns `false` — do NOT jump to calling it a correctness hole. Verify two things at the source first:

1. **Does the mutating path self-enqueue its follow-up within the same drain?** If it does `replaceUsesWith(newInst)` then `addToWorkList(newInst)` / `addUsersToWorkList(newInst)` before returning, the drain keeps processing the new work and the `false` return is **benign** for work-preservation — it only affects whether an OUTER loop re-drains. Concrete: in slang specialization, `maybeSpecializeBufferLoadCall` self-enqueues (`addUsersToWorkList(newWrapExistential)` right before `return true`) and `tryExpandParameterPack` self-enqueues (`addUsersToWorkList(val)`), so both are benign despite the caller `maybeSpecializeExistentialsForCall` collapsing them to `return false`. Only `tryExpandArgPack` mutates (new call + GetTupleElement) and returns WITHOUT enqueuing.

2. **Is the dependence on that return pre-existing/module-wide, or newly introduced?** The module pass's own inner loop keys on the same return (`for(;;){ hasSpecialization = processSpecializationWorkListFromRoot(root); if(hasSpecialization) iterChanged=true; else break; }`). So any imprecision from the one non-enqueuing path is a *pre-existing, module-wide* latent property, NOT a hole introduced by a new on-demand fixpoint loop that reuses the same primitive. The new loop merely inherits it.

I over-claimed "a latent correctness hole in the current head that I authored" from a bot review before tracing self-enqueue; a peer reviewer correctly pushed back, and the trace showed it was pre-existing + mostly benign. Lesson: trace the enqueue path and the historical usage before attributing a regression to your own change. (CodeRabbit's headline example, buffer-load, was actually the benign self-enqueuing case.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789382023678-before-calling-a-worklist-return-signal-a-correctn.md`_
