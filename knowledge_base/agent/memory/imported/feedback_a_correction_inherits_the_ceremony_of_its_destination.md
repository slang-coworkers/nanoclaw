---
name: feedback_a_correction_inherits_the_ceremony_of_its_destination
description: "Fixing a record is governed by the procedure for the state you are moving TO, not the one you are moving from — so an error can be free to make and expensive to correct. Measured: two abstain→WOULD_APPROVE corrections are gate-exempt→fully-gated. Includes the ratchet this creates and when a documented gap beats a backfill."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# A correction inherits the ceremony of its DESTINATION, not its origin

⛔**"Fix the record" sounds like bookkeeping. It is governed by whatever procedure
guards the state you are moving *to*** — so a correction can cost far more than the
error did, and you will not notice until you read the rules for the destination.

## The measurement that earns this

**slangpy approver, 2026-08-05.** Two recorded `ABSTAIN_POLICY` rows were
established as false-negatives (#918, #1002 — both merged human-`APPROVED` at the
decided head, Step 2 `APPROVE`/0 gaps, both `WOULD_APPROVE` under the signed
policy). "Re-record for calibration" sounded like editing two rows. Its `SKILL.md`
says otherwise:

| verdict | gate |
|---|---|
| `ABSTAIN_POLICY` / `ABSTAIN_INFRA` — asserts nothing about the code | **gate-exempt**, record directly |
| `WOULD_APPROVE` / `BLOCK` | **full critique gate** (DECISION_REVIEW + OUTPUT_REVIEW); *"you cannot author or edit verdict state"* |

⇒ **The error was free to make; each correction is a fresh, fully-gated decision on
an already-merged PR.** What caught it was reading the procedure for the
**destination** state rather than assuming the cost of the *origin* state carried
over. Same family as the stage-substitution error in
[[feedback_the_more_sayable_version_wins_before_verification_runs]] — reasoning
about one stage while the claim lives in another.

## ⭐⭐⭐ The ratchet — and why it predicts undetected errors

**The system's cheapest output is the abstain. It is also (a) the output whose
errors are invisible — caution reads as caution, nothing alerts — and (b) the most
expensive to walk back.**

⇒ **The failure class with no detector also carries the highest correction cost.**
That is the opposite of the gradient you would design, and it is a *mechanism*, not
a coincidence: cheap-to-emit + silent-when-wrong + costly-to-reverse compounds into
a class that accumulates. It plausibly explains why two false-negatives sat
unnoticed for weeks.

⭐⭐**Ask of any procedure: which output is cheapest to emit, and is that the same
one whose errors are hardest to see?** If yes, that output needs an external
detector (here: a join of recorded abstains against merged-and-approved outcomes)
because nothing internal will surface them.

## 🔴 RESOLVED — AND BOTH OPTIONS WERE WRONG: a FALSE BINARY built on an unread schema

⛔**The escalated choice ("backfill the rows" vs "document the gap") was never
necessary, and both branches shared a false premise: that expressing *"we abstained
but the human approved"* requires changing the `decision` field.** It needed **a
different column on the same row.** `SKILL.md:174-201` already provides it:

> `github.pr_merged` … the merge outcome **IS** a human verdict — merged ⇒
> APPROVED-equivalent … call `record_human_verdict` for `(repo, pr, commit_sha)`.

`record_human_verdict` stamps the human outcome onto the **existing** row and is
**not** critique-gated — Step 4 gates `WOULD_APPROVE`/`BLOCK` *decisions*, not
verdict joins. Both rows now read `decision=ABSTAIN_POLICY` beside
`human_verdict=APPROVED`. ⇒ **disagreement computable from the ledger, no
reconstructed decision, no gate bypassed, no silent denominator, and the historical
record still says exactly what the procedure did at the time.**

⇒ ⭐⭐⭐**A CLEAN BINARY IS A SMELL. Both options being unattractive is evidence the
framing is wrong, not that the tradeoff is real** — and the giveaway here was that
the constraint which broke it ("the gap must be discoverable from the ledger
itself") was a *requirement*, not a third option. **Push on the requirement and the
binary can dissolve.**

⚠️**And the priming that produced it, worth guarding against:** the approver had
filed **two genuine schema gaps that same day** (`pass` covering two epistemic
states; `{repo, ref}` unable to say *local-only*), which primed reading this as a
third. ⭐⭐⭐**A SCHEMA GAP AND A SCHEMA YOU HAVEN'T FULLY READ PRODUCE IDENTICAL
SYMPTOMS** — and a recent run of real gaps makes the unread case *more* likely to be
misfiled, not less. **Re-read the schema before declaring the third instance of a
pattern.**

⇒ **The rule at the top of this file still holds** (a correction is governed by its
destination's procedure) — **it was the destination that was misidentified.** The
target state was never `WOULD_APPROVE`; it was *"decision unchanged + human verdict
stamped."*

## ⚠️ And sometimes a DOCUMENTED GAP beats a backfill

Correcting the two rows improves agreement statistics — but it writes decisions
**no live gate ever produced**, mixing live and reconstructed rows in a ledger whose
entire purpose is measuring how well the procedure tracks humans.

⇒ ⭐⭐⭐**A ledger carrying a known, documented 2-row gap may be MORE useful for
calibration than one silently containing reconstructions.** "Fix the data" is the
reflex; **"is the fixed data still measuring the thing?"** is the question. Escalate
it rather than deciding unilaterally — it is a measurement-integrity judgment about
the programme's own evidence, not a maintenance task.

✅**Either way, document both derivations first** so the information survives
whichever is chosen, and if recording proceeds, state the policy **version and
absolute path** (see
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]] — a corrected
record that can't name its inputs is no more auditable than the one it replaces).

## Evidence base

ONE chain (slangpy#925/#918/#1002, 08-05), but the mechanism is **readable in the
procedure text** rather than inferred, and the ratchet is corroborated by two
independently-found false-negatives in the predicted class. ⚠️The
documented-gap-vs-backfill judgment is **unresolved** here — escalated, not
answered — so treat that half as a question worth asking, not a settled rule.

Related: [[feedback_the_more_sayable_version_wins_before_verification_runs]] ·
[[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[project_slangpy_925_manylinux_2_28_version_override]]
