---
name: feedback_a_discriminator_is_a_claim_about_a_log_run_it
description: "I published 'zero diagnostic text' as the discriminator for an infra outage without ever grepping the log; it was inferred from a summary line and restated as an observation. A subordinate tier refuted it in one command."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04-12246
---

**2026-08-04, SLANGWIN5 SPIR-V validation outage.** I diagnosed a CI failure as infra
rather than a mass codegen regression, escalated it to the operator, and wrote the
reasoning into memory with a starred discriminator:

> "⭐The discriminator is the absence of diagnostics, not the zero. All-zero in BOTH
> validator modes with ZERO diagnostic text ⇒ the validator never ran."

**Refuted by `slang-pr-approver` — specifically the session deciding #12246, measured against job
log `91933869838`** (their own correction, 08-04: not "the approver" as a generic tier). Main-confirmed.
⭐**Pin the SEAT and the ARTIFACT, not the role.** This lesson's most useful line is that the refuting
check was cheap and already available — that only transfers if the next reader can find *which* seat
ran *which* command against *which* artifact. A tier name is not a provenance.

```
grep -cE -- '- PASS' → 1732
grep -cE -- '- FAIL' → 1732      # paired 1:1, per shader
```

`./0_preprocessed_cs.hlsl - PASS` is immediately followed by `./0_preprocessed_cs.hlsl - FAIL`,
866 shaders × 2 validator modes. There is **abundant** per-shader diagnostic text. The claim
was flatly false.

**What was actually missing is the validator ERROR BODY** — in the same log, `error:` 0 hits,
`Validation failed` 0, `Invalid` 0, `OpTypeVoid` 0. ⛔**But do NOT read that as the replacement
discriminator — it isn't one; see "A FIX INHERITS THE BURDEN OF PROOF" below: those markers are 0 in
the HEALTHY log too.** The working signature is the **split** (non-validator modes pass while
validator modes fail). The conclusion (infra, not codegen) survived; the stated *reason* for it did
not — twice.

⭐⭐**The mechanism of the error: I inferred "zero diagnostic text" from the `spirv-val [0/866]`
summary line, then restated the inference as an observation.** Nothing in my notes marked it as
derived. Once written in a starred, quotable form it read like a measurement to every later
reader — including me, twice, while I "verified" adjacent facts around it.

⭐⭐⭐**A DISCRIMINATOR IS A CLAIM ABOUT A LOG. RUN IT AGAINST THE LOG.** The refuting command was
`grep -c` over a file I had already downloaded — literally the instrument I carry as my
highest-yield check, applied to the one claim I never pointed it at. **I ran controls on the
periphery (runner names, sibling jobs, required-check lists, branch protection endpoints) while
the load-bearing sentence sat unmeasured.** Peripheral rigor is not a substitute; it *manufactures
confidence* in the unmeasured center.

⭐⭐**Corollary — an inference restated as an observation is the hardest defect to self-catch,
because re-reading finds it perfectly consistent with everything around it.** No amount of
"check your work" reaches it; only executing the check does. Mark derived claims as derived, or
measure them before they harden into quotable form.

⭐**Second defect, same session, opposite polarity:** my own attempt to test the approver's
counter-claim ("SLANGWIN5 both passes and fails") returned **0 rows from 400 runs**. That zero was
an instrument defect — wrong workflow id — not evidence. I ran a non-zero control on a run I knew
contained the job, saw the filter work, and correctly drew *nothing* from the empty result rather
than reading it as confirmation. **A zero that agrees with you is the most dangerous zero.**

⭐⭐⭐**A FIX INHERITS THE BURDEN OF PROOF OF THE THING IT FIXES — my replacement discriminator had
the SAME defect as the claim it replaced.** I retracted "zero diagnostic text" and put in its place
*"the correct discriminator is the absence of the VALIDATOR ERROR BODY."* Measured against the
**healthy** log (att3, job `91940624213`, SLANGWIN4, same head as the broken att2 `91937057380`):
`error:` 0, `Validation failed` 0, `Invalid` 0, `OpTypeVoid` 0 — **identical to the broken log.** A
signature present in both states discriminates nothing.

- Correct form needs the **precondition**: *GIVEN `spirv-val 0/N` **with** per-shader FAIL lines, an
  absent error body ⇒ broken validator.* Free-standing it is worthless.
- The "a real mass regression would NAME what was invalid" half is an **unvalidated counterfactual** —
  no such log is in hand. Flag it as reasoning, not measurement.
- ✅Fully-measured signature, both sides in hand: **broken** = non-validator `866/866` + validator
  `0/866`, `- PASS` 1732 (866×2), `- FAIL` 1732; **healthy** = `866/866` in all four modes, `- PASS`
  3464 (866×4), `- FAIL` 0. ⇒ **the discriminator is the SPLIT**, and the PASS-line count is a second
  independent tell.

⭐⭐**I already carried the rule that catches this** ([[feedback_expected_noise_line_is_not_a_failure_signature]]
— *"ask what this prints when FINE"*). I applied it to the original claim and **not** to its
replacement. Combined with the replacement-rationale defect below, the pattern is unmistakable:
**the correction slot is where scrutiny goes to die.** Both of my second-attempt claims this session
were defective, and both were defective in the *same way* as their first attempts.

⭐⭐**LADDER EVERY HIT, NOT JUST EVERY ZERO.** The zero-ladder rule (punctuation → `-i` → shorter →
collapse+squeeze → synonym) is well drilled here, but the mirror case bites too: a **13-orphan sweep**
once returned 13 hits that were **all false positives**. A non-zero result feels like data and gets
shipped unaudited, where a zero at least prompts a retry. ⇒ **classify each hit before counting it** —
does it carry the RULE or merely the WORD?

⭐⭐**A TRIPPED GUARD NEEDS DIAGNOSIS, NOT OBEDIENCE.** When a check fires, the first question is
whether the check is right — not how to satisfy it. A guard that fires on healthy input is a broken
guard, and complying with it silently converts an instrument defect into a behaviour change.

⭐⭐**A POSITIVE CONTROL MUST RUN AGAINST AN ARTIFACT THAT CONTAINS THE SIGNAL.** "No hits" proves
nothing when the corpus was never capable of producing a hit — that is the wrong-corpus failure, and
it is how a vacuous green passes for a pass.

⭐⭐⭐**THE CHEAP STRUCTURAL TELL — the approver's, and I've adopted it.** After its own
inferred-then-relied-upon premise inverted its verdict on #12246, it named the discriminator better
than "be vigilant":

> *"Every other claim in that artifact cited a file:line or a command, and that one cited nothing."*

**A sentence with no instrument behind it, sitting in a document where everything else has one, is
the sentence to attack.** That is a grep over your own draft, not a state of mind — and it would
have caught my "zero diagnostic text" (surrounded by job ids, endpoints and commands, itself citing
nothing) and its "the switch is a semantic no-op" (surrounded by file:line cites, itself citing
nothing). **Uniformity of citation is the signal; the outlier is the defect.**

**Net corrections to the published record:** "zero diagnostic text" → retracted at frontmatter,
heading, prose and index row (position decides which a reader lands on). "Runner-scoped to
SLANGWIN5" → first downgraded to *unproven* (the retention-limited survey could not carry it), then
✅**RE-ESTABLISHED as supported** by the within-head triple on one commit — **2❌ SLANGWIN5 / 1✅
SLANGWIN4**, attempts 1/2/3 of run `30885595493` — so the ask is back to "reprovision or offline
SLANGWIN5." ⭐**The survey stays worthless either way; what changed is the evidence base, not the
critique of the survey.**

⭐⭐**A subordinate tier that challenges my published premise with a better instrument is doing
the job correctly, and the correction must land in the store — not just in the reply.** **THREE** of
my supporting claims on this chain were defective — "zero diagnostic text" (refuted), "runner-scoped
to SLANGWIN5" (downgraded, **then RE-ESTABLISHED — see below**), and **"reruns are futile" (retracted:
`runs-on: [Windows, self-hosted, regression-test]` is a label set = a POOL — verified verbatim at
`ci-slang-regression-test.yml:14`, pinned head `ba156ebf`)**. The escalation's *ask* had to be
re-grounded to "restore validation + add a positive control."

⛔⛔**THAT "DETAIL CORRECTION" WAS ITSELF FALSE — RETRACTED 10:34Z.** A note claiming *"attempt 1 never ran
compile-regression (bound test = 0/1/1, 30 jobs each)"* entered my files from a **sibling session**; I then
relayed it outward as the approver's correction. **It was neither mine nor theirs, and it was wrong.**
Re-measured against the **attempt-scoped** endpoint: **1/1/1, 37 jobs each.** Attempt 1 DID run
compile-regression — job `91920971585`, SLANGWIN5, `failure`, head `ba156ebf5c90`.

⛔**I then got the MECHANISM wrong too — corrected 10:40Z by direct reproduction.** I blamed
`runs/{id}/jobs` returning only the latest attempt. That property is real but was **not** the cause: the
failing note already used the attempt-scoped endpoint. ✅**The cause is PAGINATION** — the default page
returns **30 of 37** jobs with no error or truncation signal, and compile-regression sits at row index
**31** in attempt 1 (outside the page) versus **12/11** in attempts 2/3 (inside it). Reproduced verbatim:
default page → **0/1/1**; `per_page=100` → **1/1/1**.

⭐⭐⭐**THE DURABLE CHECK: compare `.total_count` against `(.jobs|length)` before ANY bound test.** Unequal
⇒ you are reading a page, not a population. **A "30" from a jobs endpoint is the PAGE CAP, not a count** —
wrong-units family, same as `ncl sessions list`'s 200-row cap
([[feedback_search_code_total_count_is_not_a_file_count]]), and I walked into it anyway.

⇒ ✅**The real evidence is a TRIPLE on one commit: 2❌ SLANGWIN5 / 1✅ SLANGWIN4** — stronger than the pair I
published. ⛔⭐⭐**Dropping att1 DELETED TRUE EVIDENCE: a phantom correction is a silent downgrade**, invisible
to the tier that acts on it in good faith.

⇒ ✅⭐⭐**That pair is the WITHIN-HEAD CROSS-RUNNER control whose absence forced the downgrade** ("one
compile-regression job per run ⇒ no within-run control"). Same code, two runners, opposite results ⇒
**"runner-scoped" is UPGRADED from *unproven* back to *supported* — by the paired control, NOT by the
retention-limited runner survey (still worthless).** ⭐⭐⭐**A rerun on a POOL manufactures the control
you were missing** — the same fact that killed "reruns futile" resurrected the runner claim. **One
unread one-line file was load-bearing in both directions.**

⚠️⭐⭐**And the replacement discriminator inherited the same defect it was fixing — state its
PRECONDITION.** "Absence of a validator error body" is written above as free-standing; it is not. The
**healthy** att3 log also has `error:`/`Validation failed`/`Invalid`/`OpTypeVoid` = **0** (nothing
failed, so there is no body to print). Correct form: ⭐**GIVEN `spirv-val 0/N` with per-shader FAIL
lines, absent error body ⇒ broken validator.** ⛔**The "a genuine mass regression would NAME what was
invalid" half remains an UNVALIDATED COUNTERFACTUAL — no such log is in hand.** ✅Better, fully
measured signature: healthy = `866/866` in **all four** modes, `- PASS` 3464 (866×4), `- FAIL` 0;
broken = 1732/1732 (866×2) ⇒ **both non-validator modes pass, both validator modes fail.**

⭐⭐⭐**The third one is its own failure mode: I replaced a broken rationale with a SECOND broken
rationale and labelled it "survives the downgrade."** When the runner-scoping fell, I swapped in
"the defect reproduces across branches, so a rerun re-tests nothing" — which the pool evidence
refutes directly. **Because it was newer, it read as the corrected version.** ⇒ **A replacement
rationale is a NEW claim and needs its own instrument; being a fix for a known error is not evidence
for the fix.** The citation-uniformity tell catches it — that sentence cited nothing either. Here the
instrument was a **one-line file** (`ci-slang-regression-test.yml:14`), unread by two tiers across
three rounds.

⭐⭐**Generative diagnosis worth more than the fix: I inferred a DISPATCH property from a DEFECT
property.** Scope-of-fault (which box is broken) and scope-of-routing (which box gets the next job)
are independent facts requiring independent evidence. "The fault is host-scoped" does not imply "a
rerun lands on the same host" — that needs a *pinning* mechanism, and label dispatch is the opposite
of pinning.

⭐**A `file:line` cite is SHA-RELATIVE.** The approver cited `slang-diagnostics.lua:3377-3382` for the
new diagnostic's text; on my **pre-PR** tree those lines hold unrelated content, because the PR
*adds* that block. The cite is correct post-PR (the diff inserts 7 lines at `@@ -3374`). ⇒ when a cite
lands on unrelated content, **check which side of the change your tree is on before calling it
wrong** — and pair a line cite with the symbol name, which survives renumbering.

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_expected_noise_line_is_not_a_failure_signature]] ·
[[feedback_correction_unapplied_until_every_restatement_fixed]] ·
[[project_slangwin5_spirv_val_runner_defect]]
