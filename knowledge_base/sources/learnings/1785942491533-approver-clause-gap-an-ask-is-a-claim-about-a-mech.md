# [approver/clause-gap] An ASK is a claim about a mechanism's behaviour — run the dead-gate probe on your own proposal before sending it (I proposed a clause whose failure direction cannot fire)

# I asked for a gate that passes on every PR I will ever see

**Symptom.** After a correct Step-3 judgment abstain (slang-rhi#811 R2: 6/6 clauses PASS, CI green on
7 backends, 0 🔴 — and the author had written *"Work in progress"* and pulled both reviewers), I sent
an addressed ask proposing a new Step-1 clause:

> `author_declared_ready` — PR is non-draft **AND** no author comment on the head revision declares
> WIP/not-ready.

The ask was well-formed: named addressee, explicit predicate, named artifact, real evidence. A peer
engaged with its *implementation* (correctly: the policy JSON has no `clauses` array, so it needs
code in `eval-clauses.py` plus an optional tuning knob). **Neither of us asked the cheaper question
first: does either limb of the predicate carry information?**

Measured, one command:

```bash
gh pr view 811 --repo shader-slang/slang-rhi --json isDraft   # → {"isDraft": false}
```

`isDraft == false` **on the very PR whose author declared WIP.**

## ⭐⭐⭐ Both limbs were dead, and limb 1 structurally so

| limb | verdict |
|---|---|
| "PR is non-draft" | **zero bits.** The approver workflow is driven by the `ready_for_review` / `synchronize` webhook — a PR only reaches the pipeline *after* it stops being a draft. `draft==false` is an **entry precondition**, so a clause asserting it passes on every PR the tier will ever evaluate. |
| "no author comment declaring WIP" | **not a data predicate.** Detecting "Work in progress" in free-text prose is a judgment read. A documented invariant already says a Step-1 predicate requiring such a read *"evaluates `unevaluable` and lands a spurious ABSTAIN_INFRA on every PR."* |

The peer's suggestion to use the evaluator's existing `unevaluable` state makes limb 2 **worse**: a
clause unevaluable *by design* manufactures ABSTAIN_INFRA fleet-wide, destroying the measurement
signal the wide shadow policy was explicitly widened to buy (53% abstain rate; 91% of decided
abstains later approved by humans).

This is the **dead-flag shape** — a gate whose failure direction cannot fire — which I run a
mandatory 4-step probe for **on other people's PRs**: *does a setter exist? does the failure
direction fire? is there a trigger-present control?* I never turned it on my own proposal. #811 is
its own refuting control: the clause would have PASSED and changed nothing about the decision it was
invented to protect.

## The rule

⭐⭐⭐ **AN ASK IS A CLAIM ABOUT A MECHANISM'S BEHAVIOUR AND GETS THE SAME PROBE AS A PR:**

1. **Name the input that makes it FAIL.** Cannot name one ⇒ dead gate, don't send it.
2. **Find a trigger-present control** — a real historical case where the predicate would have
   changed the outcome. If your motivating case *passes* the proposed clause, the clause is not the
   fix for that case.
3. **Check entry preconditions.** A gate asserting something your pipeline's trigger already
   guarantees is a tautology. Ask: *how did this PR reach me?*
4. **Check evaluability against the tier's data.** Free-text/diff reads belong in judgment stages,
   never in a deterministic clause evaluator.

⚠️ **Why it slipped, and this is the transferable part: a well-formed ask feels finished.** Addressee,
predicate, artifact, evidence — it *read* as rigorous, and the form supplied the felt authority that
the checking had happened. Same diligence slot as a caveat, a correction, or a novelty claim: **the
frame asserts the verification.** The missing step was a single `--json isDraft` call, cheaper than
the message that proposed it.

**What survived:** the finding, not the clause. The case is a genuine gap — every scripted input said
GO while the author said WIP — but its home is a **standing judgment probe**, not a deterministic
clause. And if scripted support is ever wanted, the only data-shaped signal is a **structured** one
(a `wip` / `do-not-merge` label), never comment prose. Net outcome: **nothing for the operator to
sign off** — the correct result, reached one command too late.
