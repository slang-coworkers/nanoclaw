---
title: "[approver/challenger-miss] 'pre-existing risk' claims need a memory-model proof, not a deref-site analogy — Slang IRInsts are arena-allocated and never individually freed"
type: learning
topic: review-approval
source: learnings/1784095223530-approver-challenger-miss-pre-existing-risk-claims-.md
---

# [approver/challenger-miss] "pre-existing risk" claims need a memory-model proof, not a deref-site analogy — Slang IRInsts are arena-allocated and never individually freed

**Symptom (PR #12109, SpecializationWorkList via IRInst::scratchData bit 2):** Devin flagged a "potential use-after-free in clear()" and labeled it "inherited from the old design". I first cleared it by arguing the new `clear()` deref (`inst->scratchData &= ~bit` over every queued entry) was equivalent to the OLD pop-path `getParent()` deref. The DECISION_REVIEW critique caught this as unsound: the OLD error-exit did `workList.clear()` on a `List<IRInst*>`, which drops pointers WITHOUT dereferencing them, whereas the NEW `clear()` dereferences every queued entry. So the deref SITE is genuinely new — "pre-existing" by analogy was wrong.

**Root cause:** I reasoned about *equivalence of a hazard* instead of *whether the hazard exists at all*. For a "can this dangle?" question the only sound proof is the allocation/free model of the object.

**How to catch it:** When a review flags UAF/dangling-pointer on IR insts, do NOT argue "pre-existing" or "same as before". Instead prove the memory model:
- IRInsts are ARENA-allocated: `IRModule::_allocateInst` (slang-ir.cpp:~1571) → `m_memoryArena.allocateAndZero(totalSize)` (~1590).
- `IRInst::removeAndDeallocate` (slang-ir.cpp:~9213) despite its name does NOT free backing memory — it only unlinks (`removeFromParent`), scrubs dedup maps, removes arguments/decorations/children. There is NO `operator delete`/`free(inst)`/per-inst arena free for a LINKED inst removed this way. (The lone `memoryArena.rewindToCursor` at ~2774 rewinds a never-linked temporary dedup-PROBE inst, not a removed real inst.)
- ⇒ A "removed" inst stays valid, readable arena memory until the whole IRModule is destroyed. Reading a scalar field like `scratchData` on it is safe (stale-but-valid), even from a work-list that outlived the inst's linkage.

**Fix:** For any "removed IR inst still referenced" concern in Slang, the answer is almost always "safe — arena memory, `removeAndDeallocate` doesn't free." Cite the arena allocation + the absence of a free path, not a deref-site analogy. This is a reusable prior: scratchData/intrusive-marker work-list PRs (see [[slang-12040-ir-type-legalization]]) recur.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784095223530-approver-challenger-miss-pre-existing-risk-claims-.md`_
