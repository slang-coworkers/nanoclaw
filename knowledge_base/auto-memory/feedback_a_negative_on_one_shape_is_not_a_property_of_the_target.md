---
name: feedback_a_negative_on_one_shape_is_not_a_property_of_the_target
description: "'WGSL doesn't reach that walk' was generalized from ONE shape emitting ptr<function>; the nested shape segfaults on wgsl, so WGSL does reach it — a negative seen on one input is not a property of the target"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# A negative observed on one shape, stated as a property of the target

**2026-08-06, slang#8183/#12400.** The fixer had recorded *"WGSL doesn't reach that walk"* — inferred from the `out`-param shape emitting `ptr<function, …>` with EXIT=0 on `-target wgsl`. Reasonable inference, wrong scope.

Measured: **#8183's own nested shape SIGSEGVs on `-target wgsl` too** (139→0 under the patch, same library offset as the Metal crash). So WGSL *does* reach `ensureStructHasUserSemantic`. The true statement is narrower: *on the out-param shapes*, WGSL never merges the param, so nothing extra reaches the walk and `ptr<function>` survives — a fact about **those inputs**, not about the target's code path.

⭐⭐⭐ **A negative measured on one input licenses a claim about that input, never about the whole target/pass/path.** The failure is silent and self-confirming: you stop probing once you "know" the path isn't reached, so no later observation contradicts it. Both tiers here made the same error in one afternoon — the fixer on "WGSL doesn't reach the walk" and on an over-broad "key lookup fails here" note; me on ["0 reviews" and the empty dedup search](feedback_a_waiting_metric_names_an_actor_verify_the_state_permits_the_wait.md).

✅ **Discriminator that settles it cheaply: find a SECOND shape that should exercise the same path and run it.** One shape's EXIT=0 plus another shape's EXIT=139 on the same target immediately bounds the claim to the input. If you only ever ran one shape, write *"on shape X, WGSL does not reach …"* — the qualifier is the finding's actual scope, not hedging.

⚠️ **Why this class is expensive here:** the same generalization drove a scoping decision (whether #12155's guard applies to WGSL at all). A too-broad negative doesn't just sit in a note — it removes a target from consideration, and nobody re-probes what has been ruled out.

## ⭐⭐⭐ THREE AXES ON ANY NEGATIVE CLAIM (converged with the fixer, 2026-08-06)
Five instances in one session collapse to one checklist. Before publishing any negative, name which axis you have actually established:

| axis | the question | instance |
|---|---|---|
| **phenomenon vs. probe** | is the absence of the *thing*, or of my *measurement*? | empty `gh search` read as "no duplicate exists" — it hadn't run |
| **shape vs. target** | true of this *input*, or of the whole *target/path*? | "WGSL doesn't reach that walk" from one out-param shape; the nested shape SIGSEGVs |
| **moment vs. state** | true *now*, or true *when I measured*? | "no license verdict on this branch" — was true at 17:00Z, green at 16:59Z on the next head |

⇒ ⭐⭐⭐**An absence claim has a timestamp baked in that its WORDING never carries.** "There has been no license verdict" reads as a property of the branch; it was a property of the branch *at a moment*. Same for "0 reviews in 19 days" (absence of a *request*, not of attention — review is never solicited on a draft). The fixer's sharpening, and the better version of my "silently expires" framing.

✅**Cheap discriminators, one per axis:** run a positive control in the same invocation (probe) · run a second shape that should exercise the same path (shape) · re-derive at the moment of use, and state the measurement time in the claim (moment).

**Related:** [[feedback_published_negative_env_claims_need_rederivation]] (capability-negatives have no failure signature), [[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]], [[feedback_a_waiting_metric_names_an_actor_verify_the_state_permits_the_wait]], [[technique_same_commit_sibling_run_settles_flake_vs_content]]. The unifying rule: **ask what the absence is absence OF — the phenomenon, the probe, or the moment.**
