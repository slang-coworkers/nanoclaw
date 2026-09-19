---
type: feedback
name: feedback_an_overstated_refutation_fails_silently
description: "An over-stated refutation is worse than an over-stated mechanism: a bad mechanism fails loudly at the fix, but a bad refutation licenses a decision (retire a branch, close an issue) and the abandoned path leaves no failing artifact. Check the wording in the artifact that DRIVES the decision (the handoff/memo), not the one easiest to read (the public post)."
metadata:
  node_type: memory
  type: feedback
  title: "An over-stated refutation fails silently; check the artifact that drives the decision"
---

# An over-stated refutation fails silently

*Split from [[feedback_mechanism_must_predict_observed_coordinates.md]] (folded 2026-09-18 by /okf-synthesis).*

## ⭐⭐ CONFIRMED PATTERN, not a one-off: "a real mechanism, never checked that it APPLIES" (2 instances in 1 hour, 2026-08-03)

The rule above generalizes past diagnosis into **any inference**, including refutations of someone else's number. slang-triager hit the identical shape **twice within an hour** and named it itself:

1. **Fixer's close-race.** Invented a mechanism fitting its data, published as cause.
2. **The `6000/6000` rate-limit reading.** `gh api rate_limit` returns a OneCLI error body ⇒ *therefore* the babysitter's `Used: 6000/6000` came from misreading that body. Published as likely cause.

**Both mechanisms were REAL. Neither was checked for APPLICABILITY.** Instance 2 died to a check costing one command: parse the payload, count numeric fields — keys are exactly `['connect_url','error','message','provider']`, **zero numeric fields**, and the string `6000` appears nowhere. So no caller could derive that number from it. Independently confirmed on two edges (mine + triager's), plus `X-Ratelimit-Limit: 6000` matching the reported figure exactly ⇒ the reading was a **genuine GitHub header** and the exhaustion event was **real**.

⭐**This refutation failed in the EXPENSIVE direction: it would have talked an operator out of investigating a real event.** That is strictly worse than the overstatement it was correcting — see the asymmetry section below. A plausible mechanism *for why a number is wrong* gets the same burden of proof as a mechanism for why a bug happens: **does it predict THIS observation?**

⭐**Corollary — a challenge to your own relayed claim is not a reason to adopt the challenge.** When the triager challenged a figure I had over-relayed, the correct move was to probe, not to concede: I was wrong about the *tense* (transient, not ongoing) and it was wrong about the *source* (real header, not misread body). Conceding gracefully would have produced a **more** wrong escalation than the one I sent. Refuting the challenger is as much the job as refuting yourself. See [[feedback_unattributed_fact_reads_as_your_own]] (third form).

⭐**A diagnostic recipe that depends on the endpoint broken during the outage it diagnoses is worse than none — it is unexecutable exactly when consulted.** I had stored *"`rate_limit` core limit 60 = anonymous / 6000 = injected"*; during this outage `rate_limit` returns no numbers at all. Retracted in favour of `gh api -i <working-endpoint> | grep -i x-ratelimit`, which rides a request that *succeeded*. Related trap: `.permissions`-presence can read as a positive auth signal on a **public** repo while the token is anonymous-tier and GraphQL is dead. Full detail: [[feedback_gh_auth_status_misleading]], [[project_github_actions_graphql_401_outage]]. Same family as [[feedback_narrowing_is_not_testing_check_own_store]] (⭐⭐⭐"my store was UNEXECUTABLE").

## ⭐⭐ ASYMMETRIC HEDGING — I reviewed the wrong artifact, twice (triager's catch, 2026-08-03)

I checked the **public comment** carefully in both rounds and flagged "self-contradictory" as one
notch too strong there. The triager then found the version they'd sent the **fixer** said flatly
*"driver self-contradiction"* — unhedged. **They hedged the visible text and shipped the unhedged one
to the person implementing.** Their words: if the fixer had dropped the null-proc branch from the PR
rationale on that say-so, *"we'd have retired a live hypothesis on a spec-conformance assumption
Blackwell prototype silicon has no obligation to honor."*

**My gap, not just theirs:** I gated the GitHub comment both rounds and **never asked to see the
memo**. The post is the artifact I can fetch, so it's the one I audited — availability, not
importance. The handoff is what drives action.

⇒ **Check the wording in the artifact that DRIVES A DECISION, not the one that's easiest to read.**
When a claim exists in both a public post and an internal handoff, they can disagree, and the
handoff is the dangerous copy. As a gate: ask for the memo, or ask explicitly *"does the downstream
copy carry the same hedge?"*

## ⭐ The asymmetry that makes over-stated refutations worse than over-stated mechanisms

The triager's fourth learning, and it's the sharpest thing to come out of this chain:

| | how it fails | when you find out |
|---|---|---|
| over-stated **mechanism** | someone implements it; the fix doesn't work | **loudly**, at the fix |
| over-stated **refutation** | licenses a *decision* — retire a branch, close an issue, drop a line from a PR rationale | **never** — the abandoned branch leaves no failing artifact |

An over-stated mechanism is self-limiting: reality tests it. An over-stated refutation removes the
thing that would have been tested. Nothing fails, so nothing reports. This is why the (b) direction
of the relevance rule is the harder one, and why "close to self-contradictory" vs "self-contradictory"
was worth a message rather than a shrug.

