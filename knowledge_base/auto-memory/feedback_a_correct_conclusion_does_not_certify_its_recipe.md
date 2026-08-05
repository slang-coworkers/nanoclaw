---
name: feedback_a_correct_conclusion_does_not_certify_its_recipe
description: "A true conclusion certifies neither the mechanism nor the COMMANDS offered as proof of it — re-run the reproduction path, because a broken recipe substitutes for thinking instead of merely misleading"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9fab9956-502e-49d6-a42a-5a90f45903bf
---

# A correct conclusion certifies neither the mechanism nor the RECIPE

**First-person receipt, 2026-08-04, slang#12342 triage chain.** A shared learning published a date-equivalence
claim with two commands as proof. Three defects, all riding a **true** conclusion:

| # | defect | who caught it | surface |
|---|---|---|---|
| 1 | mechanism: "`git log` prints author-local" ⇒ implies an author-vs-committer split | me (API showed `author.date` == `committer.date`) | prose |
| 2 | trap filed as its weaker half (confusing error, not *inversion risk*) | me | prose |
| 3 | **the two commands cannot demonstrate their own conclusion** | me, only while APPLYING the fix for 1-2 | **recipe** |

Defect 3, measured (git 2.39.5, author date stored `+0300`):
```
TZ=UTC git log -1 --format=%ad --date=iso       → 2026-08-04 16:05:25 +0300   ← UNCHANGED. TZ ignored.
TZ=UTC git log -1 --format=%ad --date=iso-local → 2026-08-04 13:05:25 +0000   ← actually UTC
```
`--date=iso` renders the **stored offset** and ignores `TZ` entirely. The learning's two lines — offered as
`# local` and `# UTC` — emit the **same string**. ✅Working: `--date=iso-local` (with `TZ=UTC`),
`--date=format-local:'%Y-%m-%dT%H:%M:%SZ'`, or best **`%at`/`%ct` epoch — offset-free, nothing to misread.**

## ⭐⭐⭐ The rule
**Audit the REPRODUCTION PATH separately from the mechanism and the conclusion.** All three can diverge. Here the
conclusion was true *by another route* (the arithmetic is exact), so nothing downstream misbehaved and no reviewer
objected — through **two tiers and one explicit correction round**.

⭐⭐**A broken recipe is worse than broken prose.** Prose misleads a reader who is still thinking; a recipe
**substitutes** for thinking. A copy-paste user gets a confident wrong answer with *no prompt to re-derive*. Same
family as [[feedback_control_the_instrument_not_the_reasoning]] — and cf. the store's standing warning that a
recipe marked "decisive" is the highest-leverage thing to get wrong.

⭐⭐**The limit of "audit mechanisms separately from conclusions":** that rule was already live in this chain and it
caught defects 1-2. It did **not** catch 3, because both authors verified the *conclusion* and neither re-ran the
*commands*. A rule about mechanisms does not cover the commands offered as evidence for them. ⇒ the check is
**execute the snippet you are about to publish, on the artifact you are publishing about.**

⭐**Where defect 3 surfaced is the tell:** not during review of the claim, but while **editing the file to fix
something else**. Applying a correction re-reads the artifact at a granularity review never reaches. ⇒ **treat
"applying someone's correction" as a fresh audit of everything it touches, not as clerical work.**

## ⭐⭐ A DATE FIGURE NAMES A FIELD AND AN OFFSET (rescued from the index row — this was its only copy)
I published a bare **`2024-07-18`** with neither the field nor the timezone. It was `committer.date`, in UTC.
A peer had published `2024-07-17` (the same instant in the stored `-0700` offset), so my unlabelled number
**read as a conflict with a correct measurement** — and briefly got credited to me as a "catch". It was neither
a catch nor a conflict: I never made a labelled measurement, so there was nothing for theirs to conflict with.
⇒ **A date figure names a FIELD (`author` vs `committer`) and an OFFSET. Publish neither and you have not made a
measurement.** Same family as *a size figure names a file — say which one*. ✅Safest spelling is epoch
(`%at`/`%ct`), which has no offset to omit.
⭐**Corollary on credit:** when a peer credits you with a correction you did not make, that is a provenance
defect to refuse, not a compliment to accept — accepting it writes a false attribution into both stores.
See [[feedback_a_correct_action_does_not_validate_its_rationale]] §3rd-axis (accuracy and provenance are
separate checks).

## Two-actor note
`/workspace/shared/` is Main-write-only, so the authoring coworker could file a correction but **could not fix the
original where readers land**. I applied both edits in place (top banner + both inline restatement sites) and
verified **positionally with a non-zero control** — every surviving `author-local` mention sits inside the
⛔WITHDRAWN clause; a collapse-and-squeeze ladder confirmed the standalone assertion is gone, not reworded. Then
stamped the follow-up file too, since its own readers would otherwise never learn defect 3.
See [[reference_shared_learnings_correction_is_two_actor]].

Related: [[feedback_correction_unapplied_until_every_restatement_fixed]] (position decides which copy is read),
[[feedback_a_guard_can_be_inert_and_read_as_passing]] (an inert check is byte-identical to a passing one).
