---
name: feedback_a_claim_with_no_possible_witness_in_its_own_artifact
description: "A THIRD way to be wrong with nothing false in the evidence: a truth-apt sentence no output of its own artifact could contradict. Measured — a test comment said lanes print 'in decimal' where hex(1,2,3)=['1','2','3'], identical either way. Tell: name the output that would contradict it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A claim with no possible witness in its own artifact

**slang#12330, 2026-08-06.** slang-triager's companion test carried the comment *"the thrown error code
is printed in hex, the returned lane values in decimal."* The directive has no `-output-using-type`, so the
whole buffer dumps **hex**. The comment was wrong — and the decisive part is *why it was unfalsifiable*:

```
hex(1,2,3) = ['1','2','3']     ← identical to their decimal spelling
```

⇒ **lanes 1–3 read the same in either base, so "in decimal" could never have been contradicted by any
output this test produces.** Not merely false: **truth-apt, and with no possible witness in its own
artifact.**

## ⭐⭐⭐ This is a THIRD species, distinct from the two already logged

All three share the property that **nothing in the evidence is false**, which is why no control, complement
or re-measurement catches any of them:

| species | what is unverified | example |
|---|---|---|
| unverified **join** | the composition of two true facts | the generic-arm claim ([[feedback_a_helper_choice_needs_the_arm_that_distinguishes_it]]) |
| unverified **quantifier** | the scope word wrapped around a sound argument | "unreachable by construction" ([[feedback_an_enumeration_claim_needs_a_computed_complement]]) |
| **no possible witness** | nothing — the sentence is simply untestable *here* | this: scope fine, composition fine, and **no output of the artifact bears on it** |

⚠️**What made it read as informed: it was prose sitting next to passing `CHECK` lines.** Adjacency to
verified assertions lends credibility a sentence never earned — the same *adjacent-to-verified* mechanism as
[[feedback_i_stamped_verified_on_a_fact_i_only_transcribed]], here at the level of a whole claim rather than
a clause.

⇒ ⭐⭐⭐**Cheap tell: ask what output would CONTRADICT this sentence. If nothing the artifact emits could, it
is decoration — delete it or make it testable.** Same shape as the fixer's `12326` guard that contained no
entry-point `throws` and therefore could not discriminate patched from pristine: a check that cannot fail
is not a check, and a comment that cannot be wrong is not information.

## ⭐⭐ Reviewer A's counter-intuitive flag, worth keeping on its own

`compare 80e4e31e5455...34479160da97` → ✅**verified myself: 2 files, +8/−1, ZERO lines under `source/`**
(`docs/user-guide/03-convenience-features.md` +6, the companion test +2/−1) ⇒ the correctness review holds
at head, with **8 lines unreviewed**.

Reviewer A flagged those 8 anyway, and the reasoning inverts the usual instinct: ⭐⭐⭐**a documentation edit
made IN RESPONSE TO a reviewer finding, then never reviewed, is exactly where an error survives — the
response feels like it inherits the finding's scrutiny, and it doesn't.** ⚠️Sharper still here: **one of
those 8 lines is the fixer correcting the triager's prose**, so the lowest-risk file in the diff is the one
that just absorbed an unreviewed fix to a claim that was already wrong once.

## ⚠️ Standing gap on this PR: no third-party execution

Local tests are **35/35 from the machine that wrote the patch**, and CI is zero-signal — independently
censused twice at `{failure: 2, skipped: 33, success: 1}` with every build job skipped. **Not a defect and
not grounds to hold**, but ⭐**the only green a human can see has a single origin, and the badge shows RED
for an unrelated reason** (`check-ci` + `wait-for-human-priority` = the documented priority-yield). Both
facts are stated in the PR body — which is the correct handling: the artifact carries its own provenance
limits rather than letting a reader infer verification that does not exist.

## Related

[[feedback_a_count_can_answer_a_different_question_than_you_asked]] (a probe that cannot detect what it is
cited against) · [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (six ways a probe lies) ·
[[project_12330_entrypoint_throws_not_diagnosed]]
