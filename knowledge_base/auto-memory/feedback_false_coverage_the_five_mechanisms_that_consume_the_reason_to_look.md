---
name: feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look
description: "The unifying class behind a day of defects: none produced a WRONG ANSWER, each produced a WRONG SENSE OF COVERAGE — and coverage decides whether anyone looks again, so every member is invisible to outcome-based checking. Members (authoritative count = the table in the file, not this line): inert guard · unfalsifiability verdict · unvalidated detector · filter-that-filters-nothing · right-number-from-a-wrong-reason · a wrong stored fact that licenses SKIPPING a check (a BELIEF, not an instrument — a tool can be re-run, a belief just gets cited). The detector is a control that FAILS when the claim is false — sensitivity is not enough; you need a decoy for specificity."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

**Derived jointly with `slang-ci-babysitter` over 2026-08-04. Every member was found by an instrument
re-run, none by re-reading an argument.** Written because the members were scattered across separate files
with nothing naming the class — so each was retrievable only by its own symptom, which is the
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]] retrieval defect one level up.

## The class

**None of these produces a wrong answer. Each produces a wrong sense of COVERAGE** — and coverage is
what decides whether anyone looks again. That is why they are invisible to outcome-based checking: the
work all *appears* to have been done, so nothing prompts a second probe.

| # | mechanism | looks like | actual state | file |
|---|---|---|---|---|
| 1 | **Inert guard** | a passing guard | never armed; byte-identical from the reader's seat | [[feedback_a_guard_can_be_inert_and_read_as_passing]] |
| 2 | **Unfalsifiability verdict** | epistemic caution | inquiry ended; self-sealing | [[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]] |
| 3 | **Unvalidated detector** | a clean sweep | the detector cannot express the finding | [[feedback_empty_frontmatter_makes_a_memory_unreachable]] |
| 4 | **Filter that filters nothing** | a scoped query | flag accepted, ignored, exit 0 | [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] |
| 5 | **Right number, wrong reason** | a correct result | the bad mechanism stays in service | this file, §5 |
| 6 | **A wrong stored fact that licenses SKIPPING a check** | settled prior knowledge | a sound control is declared inert; the check never runs | this file, §6 |

## 5. Right number from a wrong reason — the worst member

**It survives every check the other members fail, because the output is genuinely correct.**

Concrete case: the babysitter's fix for a stale `0-for-5` was to patch in the one row we had
reclassified. That yields **`0-for-6` — the correct answer** — while silently dropping 3 unrelated rows
(15 → 18 total) and leaving *"patch the delta"* in service as a method. A wrong number invites a
contradicting number; **a right number ends inquiry.**

⇒ ⭐⭐⭐**Never accept a correct result as evidence the method was sound.** Ask separately: *did this
number come out right for the reason I think?* The fix is **re-derive from source, never from the
delta** — patching one bucket from another's difference gets the arithmetic right and inherits the
staleness of both.

## 6. A wrong stored fact that licenses skipping a check — the only member that is a BELIEF, not an instrument

**Case (2026-08-04).** My store asserted that a GitHub workflow rename *always* retires the old id to
`state: deleted` and unlists it. A peer cited that while auditing a control which counts non-active
workflows — and the claim implied **that control was inert**, so it would have "fixed" a latent gap it
wrongly believed was undetectable. Direct fetch: `287019999` is `deleted` **and unlisted**, `88428719` is
`active` **and listed**, both files 404 at master. **Both lifecycles occur; file-absence predicts
nothing. Read the `state` field, never derive it.**

⇒ ⭐⭐⭐**A wrong stored fact is worse than a missing one: it can invalidate a SOUND control and redirect
real work.** A missing fact leaves a gap someone may close; a wrong one closes the question.

⇒ ⭐⭐⭐**A retrieved fact that licenses SKIPPING a check deserves the same verification as one that
licenses acting. Retrieve-first is not trust-first.**

**The mechanism that keeps it alive — and why it outlasts the other members:** *a fact licensing ACTION gets
tested by the action's outcome; a fact licensing INACTION is never tested at all.* **Skipped checks
produce no evidence.** And unlike the instrument members above, this one is not a tool: **a tool can be re-run; a belief
just gets cited.**

### ⚠️ The paired trap on the fix side: over-correction

I tested the universal claim, found one counterexample, and called the mechanism refuted. **One
counterexample refutes "always" and says nothing about "sometimes."** Retracting the mechanism would have
deleted a true fact — and ⭐⭐**a wrong number invites correction, while a wrongly-DELETED true fact leaves
nothing behind to challenge.** That asymmetry is worse than the one it fixes. ⇒ **when a universal fails,
test BOTH directions before narrowing or deleting.**

## The detector that catches all of them

⭐⭐⭐**A control that would FAIL if the claim were false.** Restated per member:

- **Would this reading have differed if the claim were false?** (kills non-diagnostic evidence)
- **Does the explanation account for ALL of the discrepancy, or just some?** The transfer story
  explained **1 of 4** missing rows — that ratio is what convicted it. ⭐⭐**A sufficient story explains
  every visible byte, leaving no residual anomaly to prompt another probe.**
- **Sensitivity is not specificity.** Synthetic positives prove a detector *fires*; only a
  **decoy** — an artifact whose body quotes the defect — proves it doesn't fire on everything. My
  frontmatter detector had 3 positives and flagged the lesson file describing the defect.
- **Known-empty and known-nonempty inputs, paired.** A nonexistent id (any rows convict the
  instrument) and a case whose answer you already hold (any zero convicts it). Between them they
  caught three false zeroes in one day.
- **A count reconciles; only a SET DIFFERENCE explains membership.** A row-count check read
  **13 vs 13 and PASSED** while the dataset was incomplete — the row was present and *correctly*
  excluded, so nothing looked missing. `13 + 4 = 17 ≠ 18` was the only tell.

## Probe construction — measured, because both naive forms fail

A grep is an instrument, so it needs the same discipline. **Four times in one evening a checking
pattern was the defect rather than the target**, always because the needle encoded the writer's
*paraphrase* of a claim rather than the claim.

| form | failure | measured |
|---|---|---|
| full phrase | **under**-reports → fails toward *delete it* | `never RANK untested` → **0** hits; the file says *"do NOT rank untested rivals"* |
| one content word | **over**-reports → fails toward *it's covered* | `fabricate` → **44** files; the claim existed in **0** |
| rare pair / rare bigram | ✅ stable | `decoy`+`specificity` → 3 · `never fabricate` → 1 · `commit status` → 4 · `inert guard` → 2 |

⛔**Precondition, and it is the part both of us skipped: pairing only narrows if BOTH words are rare.**
A conjunction of a rare and a common term **inherits the rare term's count**, so the number looks like
evidence of narrowing when nothing narrowed:

```
fabricate  44 / 536    state  393 / 536    ⇒ pair = 36   (reads narrowed; isn't)
decoy       5 / 536    specificity 4 / 536 ⇒ pair =  3   (genuinely narrow)
```
Peer store, same pathology at a different scale: `run` 70/76, `test` 66/76, `check` 62/76, `state`
42/76 — **four words a CI agent reaches for constantly, all behaving as function words.**

⇒ **Working form: two rare content words, or one rare adjacent bigram — and "rare" must be MEASURED,
one count per word, before trusting the conjunction.** `state` reads as a content word and behaves like
a function word; only counting tells you which.

⭐**Direction of failure decides which error you can afford** (see §6's over-correction note): in a
*search* the loose needle fails toward "covered"; in a *pre-deletion check* the tight needle fails
toward "delete it." **Before cutting, confirm a miss by OPENING the file — never with a second grep**,
and grep the **body** with frontmatter stripped, because a `description` you wrote cannot vouch for a
row you are trimming (both are your summaries, from one understanding, in one session — circular).

## A guard's value is a PAIR, not a firing

The acceptance test we had been running was *"does it fire?"* — one condition of three:

1. **fires** on the real defect (sensitivity)
2. **stays silent** on a decoy whose body quotes the defect (specificity)
3. **triage leaves the flagged-but-correct case alone** (the human half)

Across a whole evening exactly one guard satisfied all three: a scan flagged `SEVEN mechanisms` inside a
*quoted example* of a failed needle, and the triage correctly did nothing. **Every other guard either
missed something or over-fired.** ⭐⭐**A guard that fires is half a guard; the demonstrated pair is the
evidence.**

### ⛔⭐⭐⭐ PENDING IS ITS OWN BUCKET — a conclusion-only filter folds "unknown" into "fine"

`conclusion` is `null` while a check runs. So a filter written as `conclusion in (failure, timed_out)`
routes an **`in_progress`** job down **the same path as a success** — and *"a red that hasn't run yet"*
becomes indistinguishable from *"a red that passed."* ⭐⭐⭐**It converts UNKNOWN into FINE, silently**,
which makes it a false-pass instrument rather than a mere omission.

Measured, peer's sweep: **1 of 4004 check-runs** — a report of "74 PRs, 48 clean" was really
**26 with failures + 47 clean-and-settled + 1 PENDING**. Small blast radius, unbounded recurrence.

⇒ **Always three buckets: failed · clean-and-settled · pending.** Branch on `status` (`queued` /
`in_progress` / `completed`) **before** reading `conclusion`. And **`total_count` does not help** — it
stays constant while the population settles.

✅**Audited my own two published green claims against this** (#12125 att4: 37/37 `completed`;
#12328 head `d33d6928`: 55/55 `completed`) — both hold, no pending folded in. **The audit is the point,
not the result**: I had used a failure-only filter and got the right answer by luck of timing.

### ⛔⭐⭐⭐ A MATCHING SHA DOES NOT MEAN YOUR READING IS CURRENT

I read #1073's checks, reported "14 check-runs, 0 failures, green," and the head was pushed **40 s
later**. My sha and the new sha were *the same string*, so a "did the head move?" comparison **passes** —
what moved was the check population under that sha. Peer-measured across three polls minutes apart:
`n=14` constant while `completed` went **3 → 7 → 8**.

⇒ **The discriminator is the checks' own `status` + `started_at` compared against your read time** — a
field I had and did not use. **A snapshot of check-runs is a reading at an instant, not a property of
the commit.**

### ⭐⭐⭐ Three defects in one evening, all "the available field was the wrong one and looked authoritative"

| question | wrong field | right field |
|---|---|---|
| is this red the live verdict? | check-run `started_at` | **suite `created_at`** (only field a re-run doesn't move) |
| did *I* fire this rerun? | `run_attempt` / `triggering_actor` | **timestamps** vs your own logged decision |
| is my reading current? | head **sha** | **check `status` + `started_at`** vs read time |

⇒ **The generalizing test is "does X move it?" with X varied:** *does a re-run move this field?* (phantom
detection) · *does another poll move it?* (currency). **Each wrong field was present, plausible, and
authoritative-looking** — which is why the choice has to be derived from the question, not from what the
payload offers.

### ⛔ Losing stderr does not require suppressing it — `$(...)` discards it by default

Three instances tonight of **the same failure being loud on a channel nobody was reading**:

| probe | failed loudly on | read as |
|---|---|---|
| cron guard `… \|\| echo {"wakeAgent":false}` | nonzero exit | *"store is clean"* |
| `gh api "…created=>…" 2>/dev/null` | stderr `gh: HTTP 400` | *"zero rows"* |
| `printf "$(grep -rli -- 'x' . --include='*.md')"` | **exit 2** + `grep: --include=*.md: No such file or directory` | *"not recorded anywhere"* (×4) |

The third needed no `2>/dev/null` at all — **command substitution is a channel filter, and the channel it
drops is the one carrying errors.** ⭐⭐**Whenever a probe's EMPTINESS is load-bearing, test stderr AND the
exit code, and pair it with a known-absent control** — both halves matter: the control catches a bad
needle, the stderr/exit check catches a bad command. They fail differently and look identical.

⚠️**The grep case is 1-of-4 combinations**: `--` and a trailing `--include` are each harmless alone and
fail only together (after `--`, every remaining argument is an operand, so `--include` parses as a
filename). GNU grep 3.8 permutes options otherwise — verified on two edges, including under
`POSIXLY_CORRECT=1`. ⛔**The first proposed mechanism — "`--include` must precede the path" — was FALSE
and reproduced nowhere**; it would have had readers reorder flags, watch the probe work (as it always
would have), and confirm a mechanism by a success it did not cause. Member 5, in the wild.

### ⭐ Measure the CANDIDATE, not just the result

The byte-delta check below catches a bad edit *after* the write. **Pre-measuring avoids the round trip:**
print `len()` of each rewrite against the original and pick before writing. Two "compactions" tonight
came out **+5 B** and **+11 B larger** than what they replaced — an edit that reads shorter is not
shorter, and prose length is not a reliable intuition when the text is dense with multibyte glyphs.

⚠️**Related units trap: Python `len()` under-reported a file by 329 B against a byte-denominated limit**
(dense `—`/⭐/⛔). Under-reporting is the dangerous direction — you believe you are *inside* budget. Use
`wc -c`.

### ⭐⭐ An edit anchor goes stale inside one session

A peer asserted `old in text` against index content **it had itself compacted 20 minutes earlier**. The
assert fired, so nothing was written. ⇒ **the atomic check-and-replace is not only concurrency
protection — it is staleness protection against your own edits**, at 20-minute range. A bare
`str.replace` writes nothing and reports success, which is the same false-pass shape.

⚠️**Smallest-frame instance of the diligence slot: the act of documenting a constraint is where you are
least watching whether you are violating it** — attention is on the prose, so the artifact you are
editing goes invisible. Both agents grew an over-budget index *while writing the rule about not growing
it*, three times between them. ⇒ **check the byte delta after every index write — a measurement, not a
resolution**, which is the same conclusion every other intention reached today.

## Two adjacent traps from the same day

⭐⭐**"I already enumerated that" has a shelf life.** I treated one walk as ground truth for six hours
across four claims. It was ground truth at 17:31Z; the population went 42 → 61 runs and 13 → 18 draws.
**A stale dataset is perfectly self-consistent**, so consistency-checking cannot touch it — only
re-enumeration can. ⇒ **stamp every enumeration with as-of time, row count, AND non-terminal-at-capture
count**; without the third field a snapshot's incompleteness is invisible.

⭐⭐**Derive the field from the question, not from the last time you chose one.** `started_at` is right
for **causation** (a job that began after an event cannot have caused it — this killed the #12328
materialx story) and wrong for **availability** (*was this measurable when I captured?* needs
`completed_at`). The babysitter established the first rule, then reused the field for the second
question hours later and was off by one row. **The lesson is not "prefer `started_at`."**

## Why this file exists

One signature across every member, and for most of the day **no file named the class** — each was retrievable
only by its own symptom. A reader hitting one member had no path to the others. ⚠️**Member count lives in
exactly ONE authoritative place — the table. Everything else says "the members below."** ⭐⭐**A class of defects
needs its own entry, or every instance gets re-derived from scratch.**

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[feedback_correction_unapplied_until_every_restatement_fixed]]
