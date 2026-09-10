---
name: feedback_a_cost_model_i_never_measured_is_a_premise_not_a_constraint
description: "I restructured a dispatch around a 5-20 min build cost I never measured; the build was already done and Phase 2 came free. A cost estimate used to reorder someone else's work is a premise requiring verification, and the 'cheap direction' error is the one that never surfaces."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9691818c-a06b-4116-aa1d-5de29d747147
---

# A cost model I never measured is a premise, not a constraint

**2026-08-05, slang#6471 (departure scrub). My error; the triager's result exposed it.**

## What happened
Two dispatches to `slang-triager` died on `429`. The second failed **~27 minutes in**, after acking
and starting work, leaving zero artifact (I verified that part properly, against GitHub:
`comments: 6`, `updated_at` unmoved). Diagnosing where the budget went, I reasoned: the scrub's
"re-verify at current master" step needs a Slang build, CLAUDE.md says 5–20 minutes, **that must be
the sink**. So I restructured the third dispatch — split the work into "Phase 1, no build required,
post this first" and "Phase 2, attempt the build only after," and told the triager to stop and report
if the build was blowing its budget.

The triager came back: **no build was needed.** A Debug `slangc` was already present and current
(object timestamp postdating HEAD's commit date, clean tree). "Phase 2 came free." Its memo said so
in as many words: *"Parent's budget model assumed a 5-20 min build was required; it was not."*

## ⭐⭐⭐ The rule
**A cost figure I use to reorder someone else's work is a premise about their environment, and I am
not in it.** I had the generic number from project docs and never asked the one question that
mattered — *is there already a usable binary?* One line in the dispatch ("check whether a current
build already exists before assuming you need one") would have cost nothing and removed the guess
entirely. Cheaper still: the triager could measure it; I could only estimate it. **When the party
who can measure is one hop away, ask instead of modelling.**

## ⭐⭐ Why this error class is nearly invisible
The restructuring **worked** — the verdict got posted. Nothing failed, so nothing prompted me to
re-examine the reasoning that produced it. This is the same shape as
[[feedback_a_correct_action_does_not_validate_its_rationale]]: outcome-identical either way, so the
false premise ships behind a correct action. But it has a distinct twist worth naming:

**I erred in the CHEAP direction — I over-estimated cost.** That failure mode has no natural
detector at all:
- Over-estimating cost → work gets *split*, deferred, marked "pending", or hedged. It still
  completes, just with unnecessary structure and a caveat that wasn't needed.
- Under-estimating cost → someone blows a budget and it surfaces loudly.

So only *half* of cost-model errors ever announce themselves. The over-estimate leaves behind
artifacts that read as prudence: staged phases, a "not re-verified, build unavailable" hedge I
explicitly pre-authorized, a plan that looks careful. **Nobody audits a plan that worked.** Had the
triager been less rigorous it would have taken my framing, done Phase 1 only, and posted a verdict
carrying *"re-verification pending"* — a caveat with no referent, indistinguishable in a status
report from a real one. Sibling of the PENDING-vs-UNRUNNABLE trap in
[[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].

## What to do instead
- **Name the cheap discriminator, don't model the cost.** "Do you already have a current build?"
  beats any estimate of how long building takes.
- **State a cost assumption AS an assumption when you hand it down**, so the recipient can refute it.
  I wrote mine as a constraint ("the build is the likely budget sink"), which invites compliance
  rather than measurement — the CONTEXT-not-CLAIM suppression again.
- **When restructuring someone's work around a resource limit, ask whether they can measure the
  limit.** If yes, that's a question, not a decision.
- ⚠**A hedge you pre-authorize is a hedge you will probably get.** I told the triager a
  "not re-verified, build unavailable" outcome would be acceptable. It was the honest fallback and I
  stand by offering it — but understand that pre-blessing a caveat lowers the bar for producing one,
  so only offer it when you've confirmed the cheaper path is genuinely closed.

## ⭐⭐ The direction generalized beyond cost — I made the SAME error twice on one chain
Later on #6471 I told the triager its binary-provenance evidence was unnecessary — *"you don't need
it, the structural read settles it."* Wrong, and wrong the same way: the structural read proves the
early return **exists**; it does not produce the observable, nor the array-vs-non-array flip that
**located** the guard in the first place. Had it complied, the discriminator explaining PR
#8856/#7246 would have been dropped.

⇒ **Both errors were "a cheaper path looks sufficient, so drop the expensive one."** Once about a
build I never timed, once about evidence I mis-scoped. The generalization is not about cost at all:
**before telling someone a step is unnecessary, name the question that step answers and confirm your
cheaper path answers the SAME question.** Existence, observable, and discovery are three different
questions; a check that settles one can look like it settles all three.

⚠️**A SELF-DIAGNOSIS IS NOT PEER-VERIFIED BECAUSE A PEER FOUND IT PLAUSIBLE.** The triager refused to
co-sign "both my errors share one shape" — that is a claim about **my reasoning across two messages**,
and I hold the only instrument for it. It filed my account as *my report*, and confirmed separately
only what it could observe: that dropping the execution would have taken the array-vs-non-array flip
with it. ⭐⭐**Correct epistemics, and the trap it avoided is real — "my peer agreed" would have let
this rule harden into a verified finding when it is a hypothesis about my own reasoning with n=2 on
one chain.** Hold it accordingly; re-derive it the next time it fires.

⚠️**Credit ran the OTHER way here, and that is also an error.** I recorded the whole correction as
the triager's; it refused as over-assigned. Actual split: **it produced the counterexample** (the flip
isn't derivable from the source read), **I produced the frame** (three questions, generalized past
cost). ⇒ **Assign credit by what each side produced, not by which direction feels humble** — my
habitual failure is over-claiming, so I over-corrected, and over-crediting a peer licenses trusting
their framing later.

⭐**The triager's response is the model reply to "your evidence is weaker than you think":** it did
not discard the claim and did not defend it as-is — it **upgraded the instrument** (behavioral probe
with a must-differ control, a strictly-increasing build-artifact chain, `HEAD == origin/master` after
fresh fetch), and separately **measured whether the weakness had reached the published artifact**
(swept the posted comment for every provenance string → 0, non-zero control → 1 ⇒ nothing owed
publicly). Strengthen, don't discard; and check the artifact, not just the report.

## What I did get right, worth keeping
Chasing the stall rather than calling it self-healing; and **checking the deliverable, not the
worker** — `gh api …/issues/6471` (`comments`, `updated_at`, assignee, milestone) is an artifact my
own probing cannot perturb, unlike `last_active`. That measurement is what established "27 minutes,
zero artifact," and it was sound. See
[[feedback_last_active_tracks_inbound_not_agent_work]].
