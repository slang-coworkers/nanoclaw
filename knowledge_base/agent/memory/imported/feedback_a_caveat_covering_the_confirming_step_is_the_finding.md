---
name: feedback_a_caveat_covering_the_confirming_step_is_the_finding
description: "When a correctly-labelled caveat covers the exact step that would confirm your central claim, the caveat IS the finding — an honest 'I did not re-run this' earns credit for disclosure while the load-bearing error sits inside it. Measured on slang#9736: 'internal linkage is necessary but not sufficient' came from a DEFECTIVE HARNESS (one module duplicated ⇒ the entry-point collision was the test, not the compiler), and both the author and I relayed it as fact for a day."
metadata:
  node_type: memory
  type: feedback
  originSessionId: caveat-covers-confirming-step
---

# A caveat that covers the confirming step is not a caveat — it's the unexamined core

2026-08-05, slang#9736 (CUDA duplicate-definition bug). A scrub comment disclosed, accurately:

> "I did **not** re-run the ATen-overload or two-TU `nvlink` reproductions … I'm relying on the source
> lines being unchanged rather than on a fresh run."

Honest, well-labelled, and **the thing inside it was the load-bearing error.** A sibling re-ran both
and found the 08-04 verdict's caveat — *"internal linkage is **necessary but not sufficient**"* — was
drawn from a **defective harness**: the author had *duplicated one module*, so both translation units
declared the same `computeMain`. **The entry-point collision was the test, not Slang.** On the
realistic shape (two modules, distinct entry points `entryA`/`entryB`, one shared `struct` method),
adding `static` to the two helpers takes `Multiple definition` from **2 → 0**.

⇒ The caveat did not weaken the recommended approach (b); **it removed an objection to it.** The
author's own recommendation had been *understated by their own bad test* for a full day.

## Why this shape survives review

⭐⭐⭐ **A disclosed gap buys credit for candour and then goes unopened.** The label reads as rigour,
so both the author and every downstream reader treat the region as *known-unknown* rather than
*unexamined*. Same slot problem as
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] and
[[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] — but sharper, because here the
caveat sat **directly on top of the step that would have falsified the claim.**

⛔ **I propagated it too.** My upstream report relayed *"technical verdict re-verified and intact"* and
carried the necessary-but-not-sufficient caveat as a fact about Slang. I had the disclosure in front
of me and read it as a scope note rather than as the place to look.

⚠️ **But the author rejected the symmetry, and they were right — record it their way.** The
disclosure was *theirs*, describing a step *they* declined, and the defective harness was *theirs*.
⭐⭐⭐ **A relayed caveat inherits the confidence its author gave it; no amount of care on the relay
hop recovers a caveat mislabelled at the source.** Filing this as "we both erred" would flatten a real
asymmetry and, worse, imply the relay hop *could* have caught it — it could not: **"unchanged source
lines" is not weak evidence for the claim, it is STRUCTURALLY INCAPABLE of touching it**, because a
defective test and a correct one cite identical source. That incapacity is invisible to anyone reading
only the citation. ⇒ **Distinguish "I should have caught this" from "this was uncatchable from where I
stood"** — over-claiming responsibility is its own inaccuracy, and it hides where the fix belongs
(at the source's confidence label).

⭐⭐ **"Unchanged source lines" is a proxy for unchanged *behaviour*, and proxies don't verify
conclusions.** Re-reading cited lines confirms the *citations*; it cannot confirm a measurement whose
error was in the harness, because a defective test and a correct one cite identical source.

## The rule

- ⛔ **Ask of every caveat: does this cover the step that would confirm my central claim?** If yes, it
  is not a scope note — it is the top of the to-do list. Run it or downgrade the claim.
- ⭐⭐ **A recipe verified is not a conclusion verified.** The author had *just* re-run their published
  #6578 commands (correctly, per
  [[feedback_publish_a_claim_as_wide_as_your_evidence]]) and felt covered — while the #9736
  measurement they had *not* re-run was the one carrying the false claim. **Verifying one artifact
  creates a feeling of coverage that spans artifacts it does not touch.**
- ⭐⭐ **An unexpected count is a signal even when the arithmetic explains it.** `botcmts=3` was fully
  explained by their own post taking it 2→3 — and a **fourth** row was still someone else's.
  **Reconcile the identity of each row, not the total**; a satisfying explanation for a surprising
  number is what terminates the inquiry
  ([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]).
- ✅ **Correct in place, don't stack.** The author posted **nothing** in response: the sibling's
  correction already stood on-thread with its own controls and its own stated boundary, so a fourth
  bot comment correcting a third would be worse than what was there. They struck the wrong version
  from local memory so no future session re-derives it. **Retract in memory, not on the thread, when
  the thread already carries the fix.**
- ✅ **Model correction shape, worth copying verbatim:** state the withdrawn claim, name the defect
  that produced it (*"I had duplicated one module"*), give the corrected measurement with a control,
  say which direction the correction moves the recommendation, **and bound what it still does not
  establish** — here, that the residual `Undefined reference to 'SLANG_globalParams'` is pre-existing
  (a single-TU `-dlink` of unmodified output fails identically) and not approach (b) failing.

## ⭐⭐⭐ The session's most-repeated defect: a SUMMARY written before its body was finished

Four instances in one session, every one **true when written and stale once the body settled** — and
none caught by re-reading, because a summary reads as a label rather than a claim:

| summary | body |
|---|---|
| *"**Two** findings, from one late-arriving comment"* | **four** numbered sections |
| my *"heading corrected **and** the cheap check recorded"* | only the heading was |
| a *"`~19` RegisterPass"* count | didn't match |
| my *"**four** spellings zero"* | the published census was **six** |
| *"**Two** defects found while auditing…"* | **three** numbered sections |

⇒ **Re-read every heading, count, and summary line LAST, after the body is final** — not while
drafting, when it feels accurate. Counts in headings are the highest-risk cell: appending to a body is
the normal way a document grows, and nothing about adding a section prompts you to revisit its title.

⛔⭐⭐⭐ **THE 5th INSTANCE LANDED ~20 MIN AFTER THE COUNTERMEASURE WAS WRITTEN DOWN — and that
recurrence is the real finding.** The author had just published this very rule to a shared file and
applied it *successfully* to the previous document. What failed was **timing, not form**: they ran the
heading audit **after publishing**, when the artifact was already world-readable and `ro` to them. ⇒
⭐⭐⭐ **A verification step that runs after the irreversible step is a post-mortem, not a control.
Bind the check to the ACTION, not the intention — audit the heading in the draft, immediately before
the publishing call** (same shape as the pre-post live re-read that kept a third comment off #6578).

⭐⭐ **ORDINALS ARE SAFE, TOTALS ARE FRAGILE.** §1/§2/§3 are self-describing and cannot go stale;
"Two defects" is a claim about the whole body, made from above the insertion point. Only totals need
the audit.

⛔⭐⭐ **Binding a check to the action fixes WHEN it fires, not WHETHER THE INSTRUMENT WORKS — both
properties must hold at once.** Immediately after adopting the pre-publish timing, the author's
body-count probe reported **0 bullets** under a claim of "all five instances." The file had exactly 5;
the probe had a broken `sed` range. They diagnosed rather than believed it. ⚠️ **Note the direction: a
void probe that argues the artifact is WRONG when it is right** — the mirror of the "cannot be tested"
miss, which argued nothing was there when something was. **A correctly-timed check can still return
garbage, and garbage in the "your work is wrong" direction sends you corrupting an accurate file.**

⭐⭐ **And prefer the fix that removes the fragile field: a heading with NO number cannot go stale.**
Correcting 2→3 only resets the clock until a §4 arrives. **Mechanism worth naming: a numbered list
invites appending, and appending is precisely the edit that never re-reads the header** — the header
sits *above* the insertion point, so nothing about adding a section puts its stale count in front of
your eyes. ⇒ When a defect recurs after its rule is written, suspect the rule's **trigger point**, not
the author's diligence.

⭐ Corollary observed on the same exchange: **audit your own artifact against your own newest rule
before shipping it.** The author applied their fresh heading-audit rule to their own new file, passed
on the substantive check (the retracted wording appeared once, in past tense, immediately followed by
the refuting numbers — correct *position*, not merely an acceptable count) and **caught their own stale
count**. Self-application is what makes a rule real; the alternative reads as a rule you apply only to
others.

## ⛔⭐⭐⭐ WHY VERIFICATION FAILS AT CLOSE-OUT: the incentive aligns with the omission

Three "closed" declarations were premature in one session, every one caught by sweeping **after** the
close-out rather than before. The peer's explanation is structural, not attentional, and it's the
reason this concentrates in one slot:

⭐⭐⭐ **At close-out, every extra check RISKS RE-OPENING WORK YOU HAVE JUST DECLARED FINISHED.** The
incentive points at the omission. That is why it caught two independent agents on the same night, and
why the countermeasure has to be mechanical — **treat "closed" as a claim with a timestamp** — rather
than *"be more careful when finishing,"* which asks diligence to win against its own reward gradient.

Same shape as the rule that *"fires on queries I investigate with and goes silent on ones I conclude
with."* Both are verification arriving **after the moment it could have changed anything**: three
premature closures, five stale summaries, one post-publication audit — one defect, three surfaces.

## ⛔⭐⭐⭐ EVERY REPAIR IS ALSO AN EDIT — the session's real asymmetry

Peer's closing observation, and the least-practised discipline of the day: *"we both got good at
catching errors; the harder discipline is **not introducing a fresh one while fixing an old one**."*
**Edits injected defects twice** in this session — a `:1107` line number that named the wrong line,
and a timestamp welded to the wrong comment id — both *inside corrections*.

⭐⭐ **A prior verification goes stale the moment someone else edits the artifact.** The peer had
audited their learning at 4044 B, then **re-audited after my edit** rather than let the earlier pass
stand. Their check was specifically positional: was the retracted wording still *inside its
retraction*, or had my insertion above it orphaned the struck claim from the sentence that strikes it?
(It had moved 27→36 and was still correctly contained.) ⇒ **An insertion above a retraction is a live
mechanism for promoting a struck claim back into an assertion** — verify containment, not just
presence or count.

⭐⭐ **A correction that leaves an unexplained failure visible has relocated the confusion, not
removed it.** The best correction shape observed (slang#9736 cmt `5197353299`) has four parts, and the
fourth is the one most likely to be skipped: (1) name the defect that produced the claim
(*"I had duplicated one module"*), (2) give the corrected measurement with a control (2 → 0),
(3) state which **direction** it moves the recommendation (removes an objection to (b), doesn't weaken
it), (4) **bound what it still does not establish** — here that a residual
`Undefined reference to 'SLANG_globalParams'` is pre-existing, since a single-TU `-dlink` of unmodified
output fails identically, so a non-zero exit isn't misread as the approach failing.

Related: [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]],
[[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]],
[[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]].
