---
title: "[approver/human-disagreement] On an incremental hardening PR, 'didn't also fix the adjacent pre-existing case' is a scope preference, not an OPEN_GAP"
type: learning
topic: review-approval
source: learnings/1786115791032-approver-human-disagreement-on-an-incremental-hard.md
---

# [approver/human-disagreement] On an incremental hardening PR, "didn't also fix the adjacent pre-existing case" is a scope preference, not an OPEN_GAP

## Symptom

slangpy#1094 ("Improve persistent cache robustness", 96 lines / 4 files). I
decided **ABSTAIN_POLICY:OPEN_GAP** on three gaps. It merged **unchanged at my
exact decision commit** 63 minutes later — 18/18 CI green, `tdavidovicNV`
APPROVED, CodeRabbit's 🟠 Major thread **resolved without a reply**, zero
follow-up commits on `device.cpp` since. Every one of my three gaps was, in the
maintainer's judgment, acceptable.

My code reading was not wrong. The four positives I verified all held (the
`catch` covers both throw types, the RAII guard covers every throw site, the
backoff is bounded, the null-cache path is safe), and the three gaps were
factually real — the maintainer simply didn't consider any of them
merge-blocking. **The error was severity calibration, not comprehension.**

## Root cause

All three gaps collapse to one shape, which I mistook for three independent
signals: *this incremental improvement is incomplete.*

- Gap 1: a **pre-existing** unguarded `create_directories` left outside the newly
  added fallback. I explicitly established it was **not a regression** — and then
  counted it as an open gap anyway.
- Gap 2: the PR traded corrupt-cache self-heal for never deleting under a
  user-supplied path. A tradeoff, deliberate and directly tested.
- Gap 3: the new test covers the fallback direction but not the recovery
  direction.

None asserts the change makes anything **worse**. Each says it doesn't go far
enough. For an incremental hardening PR, the maintainer's bar is **monotonic
improvement**, not completeness: three strict improvements ship even with a
fourth case still unhandled, because the alternative is the status quo, which is
worse on all three axes.

I applied a completeness bar to a change whose contract was "better than before".
And when I noticed gap 1 was pre-existing — the strongest available signal that I
was measuring against the wrong bar — I rationalized past it ("installs the
fallback one statement too late") instead of treating it as disqualifying.

## How to catch it

Before abstaining on a hardening / robustness / defensive-improvement PR, ask of
each gap: **does this make anything worse than the pre-PR state, or only
less-good than ideal?**

- Worse than pre-PR → real gap, abstain.
- Pre-existing condition left unaddressed → **scope preference**, note it as
  advisory and clear it. "The fallback should have been installed one statement
  earlier" is a code-review suggestion, which is what the bot comment already
  was.
- A deliberate, tested tradeoff → maintainer's call, but a *deliberate* tradeoff
  on an otherwise-improving change is weak grounds to abstain by itself. (This
  cuts against my own prior learning that "deliberate ≠ inconsequential" — that
  rule is sound in isolation, and it is what the critique gate correctly applied
  here, but it must not convert every intentional design tradeoff in an
  improving change into a blocker.)
- Missing test for the success direction → real and worth naming, but on its own
  it is about *confidence in* the improvement, not evidence *against* it. Rank it
  below anything asserting incorrectness.

**Counting check:** if N gaps all reduce to "incomplete scope", that is one
signal, not N. I described gaps 1 and 2 as "each independently sufficient" for
abstention when they were two instances of the same non-blocking category —
stacked restatements read as corroboration and manufacture false confidence.

**Signal I under-weighted:** CodeRabbit's own finding was labeled `🟠 Major` +
`⚡ Quick win` — "quick win" is bot vocabulary for *cheap, optional polish*, not
*blocking*. And a resolved-without-reply thread is a maintainer signal too.

## Fix

Recorded `record_human_verdict(APPROVED)` against the decision row; the row now
carries the disagreement for scoring. This is another data point on the measured
pattern that ~91% of abstains reaching a decisive human verdict were approved —
and here the mechanism is nameable rather than diffuse, which is what makes it
actionable: **incremental-improvement PRs need a monotonicity bar, not a
completeness bar.** Next time this shape appears (robustness/hardening PR, gaps
all of the form "doesn't also handle X"), the call is WOULD_APPROVE with the
gaps recorded as advisory.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786115791032-approver-human-disagreement-on-an-incremental-hard.md`_
