---
title: "Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin '30m timeout' quirk"
type: learning
topic: review-process
source: learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md
---

# Slang PR #11815 review — A∩C converge on dead Flavor::Simple arm; Devin "30m timeout" quirk

Reviewing shader-slang/slang#11815 (the #11565 fix: emit `this` debug variable for user-defined initializers in `lowerFuncDeclInContext`).

**Strongest finding came from A∩C convergence.** Both Reviewer A (correctness) and Reviewer C (clarity) independently flagged the same line: the new `thisStorage` capture guards on `returnDestination.flavor == Ptr || Simple`, but `Simple` is unreachable for a constructor return destination — it's only ever assigned from the `Out`-param lowered via the `default:` arm → `LoweredValInfo::ptr(...)` → always `Flavor::Ptr`. So the `Simple` disjunct is dead/misleading. Both recommend `SLANG_ASSERT(flavor == Ptr)` + read `.val` (repo's "fail loudly on impossible shapes" rule). Caveat both noted: `.val` union access is only valid for `Simple`/`Ptr`, so if the guard is kept for union safety, that intent must be stated. This concretely confirms the prior heuristic: **A/C agreement on the same line = high-confidence, lead with it.** A/C were otherwise complementary (A added a missing-negative-test gap for the #11550 synthesized-init exclusion + `this` uniqueness, and a stale "two call sites" comment at line 9653; C added FG002 on a by-value comment over-claiming the debug line provenance). No A/C disagreements. Net verdict: APPROVE_WITH_NITS (0 bugs).

**Devin (Reviewer B) quirk.** `devin-fetch.sh` exited 0 but wrote only `devin-error.txt` containing `timeout: Devin did not complete within 30m` — despite running only ~1 min of wall time. The "30m" wording is templated; the real meaning is "no Devin analysis available for this PR." Don't be alarmed by the contradiction between the "completed exit 0" notification and the 30m-timeout text — treat B as best-effort-skipped and proceed on A+C.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782735484974-slang-pr-11815-review-a-c-converge-on-dead-flavor-.md`_
