---
name: feedback-a-caveat-aimed-at-the-wrong-claim-reads-as-diligence
description: A true caveat attached to the wrong claim is worse than a missing one — it reads as diligence while licensing the action it would have prevented; plus rigor transferring across an artifact boundary
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# A correctly-stated caveat aimed at the wrong claim is not a hedge

**EVIDENCE BASE: ONE chain (slang#12366/#8637, 2026-08-05), two actors, two hops.
Re-derive this first when it next fires; the ⭐ weight is mechanism strength, not
frequency.** Related: the root-mechanism rule in
[[feedback_control_the_instrument_not_the_reasoning]] and the false-coverage class
in [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

## What happened

Triaging slang#12366, the triager measured that `--since master --modified`
selects the union of committed-on-branch and uncommitted-tracked paths — **correct,
and I reproduced every cell.** It then published that a related open issue, #8637,
*"describes behavior that `formatting.sh` already has."*

The untracked-file caveat — *"Untracked files remain outside all three forms"* —
**was in the published comment, stated correctly**, one paragraph up, attached to
claim 1. It never qualified the #8637 sentence.

I then relayed *"#8637's open request is already implemented"* to the operator
having read only the issue's **title**. Opening the body (0 comments) split it:

- **Specific ask** — *"`--modified` should be used to enable looking at modified
  files too, even when using `--since`"* — **satisfied.**
- **Framing sentence** — *"should also check or format non-committed changes"* —
  **not satisfied.** Measured with a control: `--since master --modified` covers
  committed-on-branch, **staged-new**, and modified-tracked; a **never-`git add`ed
  file is invisible to every `git diff` form** and appears only in `git status`.

⇒ Correct wording: *"#8637's specific request is implemented; the residual gap is
untracked files"* — **not "the issue is done."** The wrong version licenses closing
#8637 and dropping the untracked case.

## Mechanism 1 — a caveat aimed at the wrong claim

⛔⭐⭐⭐**A true, well-stated caveat attached to the wrong claim is worse than a
missing one.** A missing caveat leaves a gap a reader may notice. A misaimed one
**occupies the slot where scrutiny would go**: it reads as diligence, so nobody
asks whether it governs the sentence that needed governing — while licensing the
exact action it would have prevented if aimed right.

⇒ **CHECK: for each caveat, name the specific sentence it qualifies, and confirm
that sentence is the one a reader would ACT on.** Proximity is not attachment —
one paragraph away is unattached. This is the same shape as *proximity to a rule
does not help* (a peer violated a rule four paragraphs after stating it), but with
the reverse polarity: there the rule failed to reach the violation; here the
qualifier failed to reach the claim.

## Mechanism 2 — rigor crossing an artifact boundary

⛔⭐⭐⭐**Verifying a MECHANISM is not verifying a TICKET'S ASK — two artifacts.**
The flag composition (mechanism) was measured flawlessly. The claim published was
about #8637's **status** (ticket). **The flawless measurement is exactly what made
the status claim feel already-checked** — rigor transferred across a boundary it
had no license to cross, in both actors independently.

⇒ **THE DISCRIMINATING QUESTION, worth running verbatim: *which artifact does this
sentence make a claim about, and did I open that one?*** Cheap, mechanical, and it
catches the case where everything you actually measured was right.

Corollary for relays: **a finding arriving as forwarded verification reads as
pre-checked.** The status claim travelled two hops and neither actor opened the
ticket. Diligence framing (caveat / correction / forwarded verification) suppresses
re-checking — which is the diligence-slot corollary already in the root rule,
observed here in a fresh form.

## What worked

The **staged-new vs never-added distinction** only appeared because the probe
included both, plus a control asking whether the untracked file was visible to
*any* `git diff` form (`master`, `HEAD`, `--cached HEAD`, `master HEAD` — all
missed it; `git status` caught it). **A boundary claim needs a cell on each side of
the boundary, and a control that must fire.** Enumerate the near-neighbours of the
category you are claiming about — "non-committed" silently contains at least three
distinct states.
