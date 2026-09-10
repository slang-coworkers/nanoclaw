---
name: feedback_issue_or_review_comment_ask_if_the_defect_survives_the_pr_closing
description: "Clean test for whether a found defect deserves its own issue or belongs in the PR review: does it survive the PR being closed? Patch-only code has no upstream bug to file and would be unreproducible on master"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# "Issue or review comment?" — ask whether the defect survives the PR closing

**2026-08-06, slang#12155.** Reviewer A found a **silent wrong-`@location` miscompile** (walk divergence: recursion on the field's *layout* vs the producer's *type*) plus an offset-kind **union** that can duplicate attributes. I asked the author whether these should split into their own issue, worried about creating a fourth overlapping artifact after #8183/#12400/#7176.

**One command decided it** — both defects live in functions that exist **only in the patch**. Main-verified against `origin/master` (`d7d59f374`, 5174 lines) with live controls:

| symbol | on master |
|---|---|
| `_collectFlattenedLeafLayouts` | **0** |
| `buildFlattenedResultVarLayout` | **0** |
| `composedOffsets` | **0** |
| *control* `ensureStructHasUserSemantic` | 4 |
| *control* `wrapReturnValueInStruct` | 3 |
| *control* `getFieldLayout` | 3 |

⇒ ⭐⭐⭐ **The clean test: does the defect survive the PR being closed?**
- **No ⇒ review comment.** It is a defect *of the proposed change*. If the PR is reworked the defect is fixed or deleted with it; if abandoned, it vanishes. Nothing to track. Filing an issue would describe **code that is not in the product** — and be **unreproducible for anyone who checks out master**, which is worse than noise: it burns a triager's repro cycle on a phantom.
- **Yes ⇒ issue.** The *producer gap* (`lowerOutParameters` never recording layout for what it appends) is a pre-existing crash on six shapes at master, so #12400 and the #8183 comment were the right artifacts for **that** — and are the wrong ones for these.

⭐⭐ **Severity and scope are independent axes, and this case inverts the usual ranking.** The `:3693` miscompile is a **worse failure mode** than the segfault it accompanies (silent wrong output vs. loud crash) *and* a **smaller scope** (unlanded patch only). So the reviewer is right to *lead* the report with it, and the author is right *not to file* it. "Severe ⇒ deserves an issue" is the conflation to avoid.

✅ **Cheapest discriminator, one command per symbol, and it needs a control:**
```
git show origin/master:<file> | grep -c "<new-symbol>"     # 0 ⇒ patch-only
git show origin/master:<file> | grep -c "<known-symbol>"   # MUST be non-zero
```
The control is not optional — a bare `0` is indistinguishable from a dead grep or a bad ref (see [[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]]; and note `grep -c` exits 1 on zero matches, so `&&`-chaining silently skips the control).

## Method note that generalizes beyond this
The author accepted that my refutation of my own earlier attribution was **stronger than their ordering trace**: theirs required tracing pass order (`:5155` before `:5162`), mine was local to the diff (the fall-through site builds its own layout via `IRStructTypeLayout::Builder` → `addField` → `IRVarLayout::Builder`, so its `typeLayout` is non-null **by construction**, making a null deref impossible *regardless of ordering*). ⇒ ⭐⭐⭐**A refutation that does not depend on execution order is worth more than one that does — reach for the local disproof first.** It survives being wrong about the schedule.

**Related:** [[project_12400_wgsl_out_param_ptr_function]], [[feedback_a_release_compiled_out_assert_does_not_protect_a_new_deref]], [[feedback_a_negative_on_one_shape_is_not_a_property_of_the_target]].
