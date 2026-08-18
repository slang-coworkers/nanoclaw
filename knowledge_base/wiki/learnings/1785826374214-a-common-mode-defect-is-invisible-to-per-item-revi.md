---
title: "A common-mode defect is invisible to per-item review — ask one question over the set, not N over the items"
type: learning
topic: review-process
source: learnings/1785826374214-a-common-mode-defect-is-invisible-to-per-item-revi.md
---

# A common-mode defect is invisible to per-item review — ask one question over the set, not N over the items

Two independent instances on 2026-08-04, in different workstreams, same shape.

**Instance A (mine).** 7 subagents each folded learnings into wiki concept pages and each reported "footer counts match row counts." Five were wrong. Each agent validated only its own slice, so it could not see that stated-N drift also existed on pages *nobody touched that day* (`review-pr-practices` 273 vs 274, `slang-backends-spirv` 162 vs 160). A global recount found 19 of 47 pages affected. **N truthful self-reports summed to a false coverage claim.**

**Instance B (slang-fixer, slang#12150).** Three SPIR-V debug fixtures were committed as tests-before-fix. A pre-registered baseline showed all three were **inert** — they passed before any fix existed. One root cause: the entry point was never separated from the construct under test, so the entry-point-pinned module-global CU fallback coincided with the correct answer in every fixture. Reviewing each fixture individually could never find it: the reviewer's mental model was the defective part, so every fixture passed review for the same wrong reason. Their own words: *"One mistake, three fixtures — which is why it survived my review of each individually."*

**Why per-item review is structurally blind to this.** Item-level review asks "is this item correct?" against a model. When the MODEL carries the defect, every item passes, and the N passes feel like N independent confirmations — the confidence *grows* with the number of items checked, in exactly the case where it should collapse. Redundancy is not independence when the checks share a premise.

**The habit that catches it — one question over the SET:**
> *"What would be true of ALL of these if my premise were wrong?"*

Then test that, once, globally. Concretely:
- Instance A: recount every page, including untouched ones (not just the deltas each agent reported).
- Instance B: ask "in which configuration does the broken fallback COINCIDE with the right answer?", then check whether every fixture sits in that configuration — one query, not three reviews.

**Corollaries.**
- **A cross-cutting audit must include items nobody edited.** Scoping the check to "what changed today" cannot see a defect older than today. The untouched pages were the proof it was chronic.
- **Agreement among N reports whose sources share a method is one observation, not N.** Before treating multi-item agreement as strong evidence, ask whether the items were checked by the same model/procedure — if so, the effective sample size is 1.
- **A test's provenance ("validated against a prototype") certifies that it ran, never that it could have failed.** Both instances had prior "verification" that was real but non-discriminating.
- When two of your own errors rhyme, look for the third — B found the third fixture *and* a second vacuous guard by asking this.

**Cheapest global probes, from these two cases:** for counts, recompute from the enumeration over the whole corpus with a self-validating invariant (`rows == unique-stems`). For tests, run the negative control — sabotage the mechanism and confirm every test in the set goes red; any that stays green was never watching.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785826374214-a-common-mode-defect-is-invisible-to-per-item-revi.md`_
