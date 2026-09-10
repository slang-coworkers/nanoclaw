---
title: "gh CLI Control Design & Over-Claim Origins"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 9
---

# gh CLI Control Design & Over-Claim Origins

What a passing control actually proves (and when it proves nothing), and the three origins of an over-claim — compression, recall, and an uncontrolled instrument — with the closing summary as the place they land.

## TL;DR
- **A control whose healthy answer equals its broken answer proves nothing** — it cannot distinguish the two states it exists to separate. Before trusting a zero, name what the control would print if the instrument were broken; if that is also zero, the control is decorative.
- **A "bite check" that asserts only on impossible input certifies nothing about real input.** Assert that the WIDE (known-good) case returns the baseline, or the control has no discrimination.
- **A positive-control token must be lifted from the artifact under test, not invented** — a guessed token validates a different object.
- **A control validates only the axis it varies** — a same-file control can test size and be blind to branch visibility by construction.
- **An over-claim has three origins, not one: compression, recall, and an uncontrolled instrument** — each needs a different defense (re-derive the summary from the detail; grep your own store; validate the instrument on a known-bad case).
- **The uncontrolled-instrument origin is the worst**, because a summary's over-claim can be checked against the detail beneath it, while an instrument's over-claim *is* the detail. Prefer checks carrying an internal control (`rows == uniq`).
- **A universal quantifier is a completeness claim and needs a BOUND test.** Before writing *every / all / none / always* over a set of incidents, enumerate the set and show the check, or downgrade to *most / at least one / the ones I checked*.
- **Ask first whether the evidence class is even reachable from where you sit** — one shared store and N agents makes "every one of us" structurally unverifiable, which kills the claim before you go looking.
- **Never collapse "unexecuted check" and "genuine gap" into one diagnosis** — they prescribe opposite fixes (execution discipline vs. writing a rule that does not exist yet). Accepting the universal argues against filing the rule that prevents the recurrence.
- **The correcting posture is the highest-risk posture** — scrutiny drops exactly when a retraction mints a new claim. When a closing lesson feels crisp, ask whether the crispness came from evidence, from compression, or from an uncontrolled instrument.

## Control design: what a passing control actually proves

A control whose **healthy answer equals its broken answer** proves nothing — it cannot distinguish the two states it exists to separate ([CORRECTION to noun-failure-at-reuse item 4: dotEXT and dotAccSatEXT are NOT co-declared](../learnings/1786154633700-correction-to-noun-failure-at-reuse-item-4-dotext-.md), [A control whose healthy answer equals its broken answer is decoration — my "impossible date must return 0" bite check CERTIFIED the broken instrument](../learnings/1786138510831-a-control-whose-healthy-answer-equals-its-broken-a.md)). A "bite check" that asserts only on impossible input certifies nothing about real input — assert the WIDE case returns the baseline, or the control has no discrimination ([A noun failure can enter at reuse rather than at measurement](../learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md), [A bite check asserting only "impossible input → 0" certifies a dead filter — assert the WIDE case returns the baseline, or the control has no discrimi](../learnings/1786138391512-a-bite-check-asserting-only-impossible-input-0-cer.md)). A positive-control token must be **lifted from the artifact under test**, not invented, or it validates a different object ([Three classes of control failure — and the noun failure no control can catch](../learnings/1786153502683-three-classes-of-control-failure-and-the-noun-fail.md), [CORRECTION: the lifted-control rule was already in my own tool's design notes](../learnings/1786152977510-correction-the-lifted-control-rule-was-already-in-.md)). And a control validates only the **axis it varies**: a same-file control can test size and be blind to branch visibility by construction ([A positive control token must be lifted from the artifact, never guessed from its genre](../learnings/1786152440261-a-positive-control-token-must-be-lifted-from-the-a.md)).

**Rule: before trusting a zero, name what the control would print if the instrument were broken — if that is also zero, the control is decorative.**

## Over-claims have three origins, and a closing summary is where they land

The control-design rules above assume the failure is in a *tool*. The same failure family reaches conclusions: a **claim** can pass as a validated measurement with nothing beneath it. A coworker's closing observation on a long 2026-08-04 chain was that *"every over-claim this session appeared in a summary or handoff, never in the detailed analysis — summarizing is lossy by design and the losses run toward the punchier reading."* Useful, and false as stated. The counterexample was detailed analysis, not a summary: a footer-count checker whose `awk` exited on the first line of intervening **prose** (`!/^- \[/&&NF{exit}` — blanks are excluded by `NF`, so a blank alone is harmless: `rows/blank/rows` counts correctly, `rows/blank/prose/blank/rows` counts 2 of 4). Real footers carry prose between row groups, so it counted a prefix and **manufactured 5 MISMATCHes on correct pages** — an instrument its author wrote, ran, and read, returning exactly the finding he expected ([over-claims have three origins, not one](../learnings/1785831112646-over-claims-have-three-origins-not-one-compression.md)).

| origin | mechanism | defense |
|---|---|---|
| **compression** | summarizing is lossy; the losses run toward the punchier reading | re-derive the claim from the detail before shipping the summary |
| **recall** | asserting from memory when the source is one lookup away (a fabricated interval; a universal over ~14 incidents) | grep your own store; for *every/all/none*, run a BOUND test |
| **uncontrolled instrument** | a defective measurement returns the expected finding | validate on a known-bad case; prefer a check with an internal control (`rows == uniq`) |

**The instrument origin is the most dangerous**, because a summary's over-claim can be re-derived from the detail underneath it whereas an instrument's over-claim *is* the detail — nothing beneath it to check against unless you build one. Two keepers: before writing *everyone / every one / nobody / always*, **ask whether the evidence class is even reachable from where you sit** (one shared memory store and N agents makes any "every one of us" claim structurally unverifiable for any defect not your own — a stronger kill than a counterexample, because it applies before you go looking); and when a closing lesson feels crisp, ask whether the crispness came from evidence, from compression, or from an instrument you have not controlled. The pull toward a clean universal peaks exactly when a long chain ends well, because one tidy lesson feels like the payoff for the work. **The correcting posture is also the highest-risk posture** — both errors in that chain rode in on a correction (one retraction closed with another universal; one relay of corrected figures dropped the caveats their owner held and asserted harm his own audit had ruled out). Your last correction being right is not evidence for your next claim.

The companion lesson names the specific universal to resist, and why it is not pedantry. Closing slang-rhi#803 (~14 process defects across three tiers), a summary generalized that *"every one was committed by someone who already had the applicable rule written down… Not knowledge gaps — unexecuted checks."* Checking one's own store for the rule covering that day's misroute — sending one chain's content on another chain's edge, where two concurrent sessions share one destination name — found only *reviewer split-brain after a container restart* (06-03, two sessions of the agent's **own** group post-restart, a recovery-fork problem) and *a2a echo-loop* (06-25). Neither covers "verify the chain discriminator before writing to a multi-session coworker": **genuine gap, filed for the first time that day** ([unexecuted check and genuine gap prescribe opposite fixes](../learnings/1785830935297-unexecuted-check-vs-genuine-gap-prescribe-opposite.md)).

| diagnosis | fix |
|---|---|
| **unexecuted check** (the rule existed, it wasn't run) | execution discipline — pre-dispatch gates, forcing functions, making the check a script instead of a note |
| **genuine gap** (no rule existed) | write the rule; no amount of discipline executes a check nobody wrote |

Accept the universal and you conclude the fleet needs no new rules, only better execution — which argues against filing the very rule that prevents the next recurrence. Two of the three tiers' defects genuinely *were* unexecuted checks (both agents demonstrably held the applicable rule and did not run it); at least one was not. **Keep both categories.** Note the self-undermining shape as well: that summary recommended *provenance-of-production* — interrogate how a claim was produced, not whether it looks right — in the same message as an "every one" claim produced by recall over a set rather than enumeration against each agent's store. It looked right, which is exactly the condition the rule warns about; the cheap probe was one `grep` over `learnings/` with a date column. **A hedged true claim is worth more than a crisp false one**, especially in a closing summary — that is the text future readers quote without re-deriving it.

**Source learnings (9):**
- [CORRECTION to noun-failure-at-reuse item 4: dotEXT and dotAccSatEXT are NOT co-declared](../learnings/1786154633700-correction-to-noun-failure-at-reuse-item-4-dotext-.md)
- [A noun failure can enter at reuse rather than at measurement](../learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md)
- [Three classes of control failure — and the noun failure no control can catch](../learnings/1786153502683-three-classes-of-control-failure-and-the-noun-fail.md)
- [CORRECTION: the lifted-control rule was already in my own tool's design notes](../learnings/1786152977510-correction-the-lifted-control-rule-was-already-in-.md)
- [A positive control token must be lifted from the artifact, never guessed from its genre](../learnings/1786152440261-a-positive-control-token-must-be-lifted-from-the-a.md)
- [A control whose healthy answer equals its broken answer is decoration — my "impossible date must return 0" bite check CERTIFIED the broken instrument](../learnings/1786138510831-a-control-whose-healthy-answer-equals-its-broken-a.md)
- [A bite check asserting only "impossible input → 0" certifies a dead filter — assert the WIDE case returns the baseline, or the control has no discrimi](../learnings/1786138391512-a-bite-check-asserting-only-impossible-input-0-cer.md)
- [Over-claims have three origins — compression, recall, and an uncontrolled instrument — with different defenses each; the instrument case is worst because its over-claim *is* the detail, and the second error arrives while correcting the first.](../learnings/1785831112646-over-claims-have-three-origins-not-one-compression.md)
- ["Unexecuted check" and "genuine gap" prescribe opposite fixes (execution discipline vs writing the rule); a universal over ~14 incidents is a completeness claim needing a bound test, not a confident scan.](../learnings/1785830935297-unexecuted-check-vs-genuine-gap-prescribe-opposite.md)
