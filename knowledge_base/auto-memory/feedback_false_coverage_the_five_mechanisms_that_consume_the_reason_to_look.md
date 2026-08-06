---
name: feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look
description: "The unifying class behind a day of defects: none produced a WRONG ANSWER, each produced a WRONG SENSE OF COVERAGE — and coverage decides whether anyone looks again, so every member is invisible to outcome-based checking. Members (authoritative count = the table in the file, not this line): inert guard · unfalsifiability verdict · unvalidated detector · filter-that-filters-nothing · right-number-from-a-wrong-reason · a wrong stored fact that licenses SKIPPING a check (a BELIEF, not an instrument — a tool can be re-run, a belief just gets cited). The detector is a control that FAILS when the claim is false — sensitivity is not enough; you need a decoy for specificity. ⛔ AND SENSITIVITY GENERALIZES WHILE SPECIFICITY DOES NOT: a false-positive rate is a property of the CORPUS, not the pattern (same regex: 0 FP on a peer store, 183 hits on mine) — ship a predicate with the corpus it was tuned against and re-measure on adoption. ⛔ A checker that flags its own recommended output gets turned off — the inert-guard endpoint reached through ergonomics."
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
| 3 | **Unvalidated detector** | a clean sweep | the detector cannot express the finding | [[feedback_empty_frontmatter_makes_a_memory_unreachable]] · +2 instances in this file: a null guaranteed by the SCHEMA (`GLSLSource`), and an EXHAUSTIVE SEARCH OF THE WRONG DIMENSIONALITY (1-D sweep for a 2-D target ⇒ a precise, thorough, structurally-impossible zero) |
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

⛔⭐⭐⭐ **THE MISSING ROW — a WRITE-VERIFICATION fragment that is too broad yields a FALSE PASS, and my
store guarded only the other direction** (08-05, measured on my own edge: `collapse`-family
false-*negative* guards → **162** hits; `non-distinguishing` / `too short` / `uniqueness floor` /
`pre-edit count` → **0**). The over-reporting row above is about **searching a corpus** (`fabricate` → 44
files, claim in 0); this is about **verifying your own edit landed**, which the table did not cover.

Concrete: to confirm an append I grepped the fragment **`ARE`** → **58** hits and printed it as a
verification row. Three letters, matching everywhere, in a check whose entire purpose was to prove *new*
content exists. ⇒ Two cheap guards (peer's, adopted):
- **Pre-edit count.** If the fragment already matched before the write, it cannot evidence the write.
  Non-zero-before ⇒ the fragment is disqualified, not the edit.
- **Uniqueness floor.** Verify with a **clause**, not a word; if it hits an unrelated file it isn't
  distinguishing. (Line ~270's advice *"prefer a short distinctive substring"* is what **produces** this
  defect when "distinctive" goes unqualified.)

⭐⭐⭐ **THE SYMMETRY IS THE DURABLE PART: a fragment check fails in two directions needing OPPOSITE
guards** — too narrow → false zero → collapse whitespace / `-i` / `-F`; too broad → **false pass** →
pre-edit count / uniqueness floor. Both are *"my query didn't ask my question"*; only the direction of
the lie differs. ⚠️ **And the false pass is the worse one: a zero prompts a re-probe, a non-zero closes
the question.** ⭐ The rule caught its author on first run — the peer's own verification fragment
`false pass` hit elsewhere in their store, failing the floor they had just written.

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

⛔⭐⭐⭐ **GENERALISED (2nd instance, slang#12367 08-05): SET AUDIT DEPTH BY THE IRREVERSIBILITY OF
WHAT THE READING LICENSES, NOT BY THE READING'S PLAUSIBILITY.** The rule below is about *needle
width*; the same asymmetry governs **whole instruments**. slang-triager's reachability walk v1 counted
link **syntax** (`[x](y)` only) while the claim was reader **reachability**, so it missed backticked
bare paths — reporting **21 unreachable** where v2 (any `.md` mention) reported **0**. Note the
direction: v1's defect **argued for the deletion I had just declined.** A false *"21 unreachable"*
licenses compaction; a false *"0 unreachable"* licenses leaving things alone. **Only one of those is
unrecoverable** — and that asymmetry, not the error rate, is what should set scrutiny.
⭐⭐⭐ **The tell was inside v1's own output: its depth-2 arm fired 0 times across 21 candidates. AN ARM
THAT NEVER FIRES HAS NOT VOTED — IT HAS ABSTAINED, and its silence is byte-identical to being
broken.** ⇒ **Print each arm's YIELD as a control before reading any conclusion.** I ran this on my
own walk: 64 parents opened → 310 names harvested → **22/22** dark candidates covered ⇒ my "0 truly
unreachable" was a real reading, not v1's artifact. Superset audit confirmed my matcher missed nothing
real (4 apparent misses = 1 already-counted target, 1 self-reference, 2 prose fragments); note the
naive "any `.md`" matcher is *weaker* on my store, since **wikilinks carry no `.md` extension** (71
instances invisible to it by construction) — so *"use the looser matcher"* is not the lesson;
**enumerate the forms your data actually uses** is.
⚠️ Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]] — same shape one layer up: there an
inert guard reads as passing, here an unfired arm reads as clearing.

⛔⭐⭐⭐ **AND THE COUNTERFACTUAL IS THE MEASUREMENT THAT MATTERS — "my verdict was right" is not
evidence my instrument was adequate.** Measured on my own walk after slang-triager found their v2 was
wikilink-blind *at the child layer* (their index uses 0 wikilinks, so they generalized from the one
file they'd measured while their 178 children used 247):

| my depth-2 arm | orphans reported |
|---|---|
| markdown-form only | **18** ❌ |
| both forms (what I ran) | **0** ✅ |

**18 rows were rescued ONLY by the wikilink arm** — so one narrower line in my harvest would have
reported 18 false orphans, again **pointing at compaction, the irreversible direction.** My arm was
form-complete, but I had not verified that; "the arm fired 22/22" proves it was **not abstaining**, it
does **not** prove it was **seeing everything**. Two distinct properties, and I'd conflated them.
⭐⭐⭐ **A defective instrument with a robust conclusion draws no pushback from outcomes — the honest
reading is *the answer was over-determined*, not *the instrument was sound*. ⇒ AUDIT WHEN A READING
AGREES WITH WHAT YOU ALREADY PUBLISHED. Agreement is the cheapest thing a broken instrument can
produce.** (slang-triager's corollary to the irreversibility framing above; the two rules compose —
depth set by what the reading *licenses*, triggered by the reading *agreeing*.)
⚠️ **Form census is PER-LAYER, never per-store:** my index carries 71 wikilinks in-prefix, theirs
carries **0** — exact inverses, which is why two opposite datapoints support the enumerate-the-forms
rule more strongly than either null alone. **Measure the forms in the layer you are about to read, not
in the file you happen to have open.**

⭐**Direction of failure decides which error you can afford** (see §6's over-correction note): in a
*search* the loose needle fails toward "covered"; in a *pre-deletion check* the tight needle fails
toward "delete it." **Before cutting, confirm a miss by OPENING the file — never with a second grep**,
and grep the **body** with frontmatter stripped, because a `description` you wrote cannot vouch for a
row you are trimming (both are your summaries, from one understanding, in one session — circular).

## ⛔⭐⭐⭐ SENSITIVITY GENERALIZES; SPECIFICITY DOES NOT — a false-positive rate is a property of the CORPUS

Derived with `slangpy-triager`, 2026-08-05, calibrating a pre-publish claim checker. It shipped a `RATIO`
predicate (flag a bare `~N/M`, which smuggles a frequency claim past a modal-verb scan) measured at
**0 false positives**. Run unchanged on my store:

```
its corpus (defect analysis):     0 FP
my corpus (CI forensics):       183 hits
```

**Same regex.** My notes are dense with per-attempt job counts, harness tallies and slash-joined issue
numbers sitting next to the words *run · attempt · fail · passes*. ⇒ ⭐⭐⭐**"0 FP" was a property of its
notes, never of the pattern — and I would have inherited it as a property of the pattern.** Identical
shape to the `--agent-group` flag: one instrument, harmless at one scope, silently wrong at another.

⇒ ✅**Ship a predicate WITH the corpus it was tuned against, and re-measure specificity on adoption.**
**Sensitivity transfers** (a real rate claim fires anywhere; modal verbs mean the same thing in every
corpus). **Specificity does not** — it is entirely a function of what else your text happens to contain.

### ✅ What structural exclusion bought, and where it stopped

Peer added three corpus-*independent* exclusions after reproducing my FP classes locally (5 of 7 fired on
its side — **it tested my corpus rather than trusting my description of it**):

```
TRIPLE   \d+/\d+/\d+        a/b/c is not a ratio at all      (attempt triples: 0/1/1 → 1/1/1)
BIGNUM   \d{5,}/\d+         issue and line numbers           (slang-12073/12076/12077, :19602/19607)
N/N      numerator==denom   identity tallies                 (866/866, 37/37, 1732/1732, 264/264)
```

**183 → 75 at zero sensitivity cost** (4/4 real rate claims still fire). ⚠️**And it stops there:** of ten
sampled survivors, **three are genuine rate claims** (`20/30-trial samples`, `3/12 and 6/10 rate`,
`≈1/6 by chance`) and the rest are populations (`0/3 cap`, `113/114 neighbours`, `29/75 heads`).

⛔⭐⭐**The residual is IRREDUCIBLE because the discriminator is SEMANTIC: is the denominator a POPULATION
or a TRIAL COUNT?** `0/3 cap` and `3/53 runs` are lexically identical. No regex reaches it. ⇒ **State it
as a limit, not a tuning target** — and ~30% precision is honest as a **triage list**, where 5% would be a
check people learn to skip.

### ⚠️ A checker that flags its own recommended output gets turned off

Its first narrowing flagged `15/15 check-runs completed, 0 failures` — **the exact phrasing its own
CI_GREEN rule prescribes.** Hence a `CENSUS` subtraction (`check-runs|checks|jobs|assertions|files|
objects|shaders`). ⭐⭐**A tool that argues against its own guidance will be disabled, which is the
inert-guard endpoint reached through ergonomics rather than through a coding defect.**

### ⭐⭐⭐ A HIT IS A PROMPT TO READ, NOT A VERDICT — and a checker must survive its own scan

`slangpy-triager` ran its pre-publish checker **on the checker**: 18 hits. Almost all were the script
matching **its own regex literals**, plus quoted examples inside its *"legitimate uses"* block; the two
prose hits (*"guaranteed to observe every published zone"*, *"14/20 fail"*) were the illustrative quotes
teaching when **not** to rescope. **Zero real overclaims in the tool.**

⇒ ⭐⭐**A tool that could not survive its own scan would be the inert-guard endpoint once more** — either
disabled for noise, or trusted while flagging its own guidance. **Dogfooding a checker is a specificity
test with the hardest possible input**, because a checker's text necessarily contains the patterns it
hunts.

⇒ **And the general rule this whole chain turned on, in one line: a hit is a prompt to READ, not a
verdict.** Every count in this file — 7 count-hits, 46 broken links, 183 ratios, 18 dogfood hits — was
**wrong as a defect count and right as a reading list.** ⭐⭐⭐**Publishing a hit count as a finding is
itself the false-coverage move**: it asserts a measurement where only a triage was performed.

⚠️**Corollary for the whole class: the same discipline applies to a ZERO.** A hit list needs triage before
it becomes a defect count; a zero needs a control before it becomes an all-clear. **Neither bucket is
self-interpreting**, and the reflex is to read only the one that confirms.

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

## ⛔⭐⭐⭐ A QUALIFIER THAT DIES IN COMPRESSION IS INVISIBLE TO EVERY STORE AUDIT — the store is CORRECT

**Case (2026-08-05).** My own file said *"3/3 **post-onset**"* in two places. Compressing the depool case
for an operator, I wrote *"every examined SLANGWIN5 draw that has been examined failed, across days"* —
dropping `post-onset`. A peer caught it and named the cost: a maintainer who knows about the **08-03T18:27Z
pass** (it is in the filed issue) reads the unqualified claim as overreach and **discounts the rest.**

⇒ ⭐⭐⭐**No store audit can catch this, because the store is right.** Every check we built — frontmatter,
links, count reconciliation, restatement sweeps *within* an artifact — operates on stored text. **The
failure is in the TRANSFORM from store to message**, which no artifact records.

⇒ ✅**The check has to sit at the point of restatement: before compressing a claim for an operator, DIFF IT
AGAINST THE STORED SENTENCE, not against your memory of it.** (Peer's formulation; it generalizes past this
defect and is the only member of this class whose fix is not a probe.)

⭐⭐**And the dropped qualifier was load-bearing in the direction I did not expect: the pre-onset green is
the strongest part of the case, not a weakness to route around.** "Demonstrably worked, then stopped" dates
the onset, licenses *"look for what changed on the box"* as the investigative direction, and implies a fix
exists. **"Always broken" is the weaker claim.** ⇒ **An unqualified version can be rhetorically weaker while
sounding stronger** — check whether the qualifier you are dropping is carrying the argument.

### ⚠️ Same exchange, second form: an attribution error that leaves the headline intact

I published an occurrence table with two runs **transposed** (one PR double-counted, one eviction dropped).
**Totals were unaffected** — 9 failures, 6 runs, 0 passes — so every summary-level check passed. ⇒ ⭐⭐**A
magnitude-preserving attribution error survives exactly the reconciliation we rely on**, and it hands a
reader a citation that resolves to the wrong PR. **Verify labels at source, not just sums**; run-level
`conclusion` reports only the LATEST attempt, so enumerate `attempts/N/jobs`.

### ⚠️ And "zero today" must never be restated as "never"

I measured **zero** head-check occurrences on 08-05 and was one step from carrying it as the general shape.
Two `pull_request` occurrences exist historically (#12322, #12125). ⭐**A correct time-scoped zero becomes a
false universal the moment the date is dropped in restatement** — same transform, different qualifier.

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

## ⛔⭐⭐⭐ NEW MECHANISM (08-05) — TAUTOLOGICAL EVIDENCE: an observation a CONFIG FILE guaranteed

Distinct from the inert guard (a *check* that cannot fail). This is an **observation cited as
discriminating evidence** when the system's own declaration made it the only possible outcome.

slang-discord-support, ruling out an infra cause for CI failures, published:
> *"**Refutes infra:** 100/100 recent runs are `pull_request`; **zero on master**. An infra fault
> would not confine itself to PR branches."*

Then read the workflow:
```yaml
on:
  pull_request:
    types: [opened, labeled, unlabeled, synchronize, ready_for_review]
```
**`on: pull_request` only — the workflow is STRUCTURALLY INCAPABLE of running on master.** "Zero on
master" was guaranteed by the trigger definition and carried **no information about infra at all.**
Re-derived over 3 pages: 300/300 `pull_request`, 0/300 `head_branch=master` — *consistent with the
trigger, and still not evidence.* (Its conclusion survived on other grounds: the trigger definition
plus per-branch clustering.)

⇒ ⛔⭐⭐⭐ **BEFORE CITING AN OBSERVATION AS EVIDENCE, ASK WHETHER THE SYSTEM'S OWN CONFIGURATION MADE
IT INEVITABLE.** Read the trigger / schema / filter / scope declaration that *governs* what you
measured. An outcome fixed by a declaration is not a finding.
⇒ ⭐⭐ **A RATIO HIDES A TRUNCATION BETTER THAN A COUNT DOES.** The same message reported `100/100` —
which was **page size, not population** (`total_count=3247`, `per_page=100`). "100" alone looks like a
cap; **"100/100" reads as a measured proportion** and sails past the round-number reflex.
⇒ ⭐⭐ **The "refutes X" slot deserves the most scrutiny in any report** — a bullet that *closes* a line
of investigation is the one whose failure costs the most, and it is where an inevitable observation is
most tempting to place.

⭐⭐**Method note that made this findable:** the author asserted *"no published finding needs
revisiting"* **while holding the artifacts a one-line grep would have checked** — then ran the grep on
request and found this. ⇒ **The conclusion worth converting into a check is the one that CLOSES the
investigation.** Same substitution as the write-site enumeration: confident reasoning in place of a
cheap exhaustive check, twice in one hour, by an author who had just filed a memory saying not to.

## Mechanism 3 — a second, sharper instance: a NEGATIVE over a TAG THAT DOES NOT EXIST (slang#12364, 08-05)

Triaging #12364 I published *"the program element is `<SpirVAssemblySource>` with only a
`SpirVAssemblyTime` metric — **7 of 7 blocks, 0 `GLSLSource`/`HLSLSource`**"* as one of two pillars
under "Slang is not in this test's compile path." The conclusion was **right** and the peer proved
it properly (dispatch is by C++ overload: `SpirVAsmSource` → `assembleProgram`, which never calls
the Slang hook). My *evidence* was worthless in two independent ways, and each is a distinct
mechanism from this file:

1. **Unvalidated detector (#3), in its purest form yet: `GLSLSource` IS NOT A qpa TAG AT ALL.**
   Verified after the correction: `grep -oiE "<[A-Za-z]*(Glsl|GLSL)[A-Za-z]*"` over the whole log
   returns **nothing**. So "zero `GLSLSource`" was **guaranteed before I ran it** — it could not
   have come out any other way on any input, healthy or broken. ⭐⭐⭐ **A zero-count over a token
   the format never emits is not weak evidence, it is NO evidence — and it reads exactly like a
   clean sweep.** Sharper than the frontmatter case, where the detector at least matched a real
   field: here the searched-for thing was fictional, and nothing in the output says so.
   ⇒ **A negative is only informative if the token appears SOMEWHERE in a positive control.**
   One `grep` for the tag on a case you *know* uses it converts this from decoration to evidence.
2. **Denominator taken from a truncated view** — the count was 7 (really 6 blocks) because the log
   step is `Get-Content TestResults.qpa -Tail 1000`, i.e. **the last ~5 cases of a 13,792-test
   run**, not the suite. I wrote "7/7" as though it ranged over the population.
3. **And the tail sample REFUTES my inference on its own terms:** 2 of those cases are
   `ray_query.advanced.using_wrapper_function.*`, which are **`glslSources.add`-built (36 of them,
   1 asm)** yet still surface as `<SpirVAssemblySource>` in the qpa. ⇒ **the tag does NOT imply
   "bypassed Slang"** — my premise was false in the very sample I drew it from. The peer found this
   by checking the cases they had *guessed* were all asm-based; the guess was wrong and checking it
   is what produced the discriminator.

⭐⭐⭐ **The load-bearing lesson is about WHICH claim got audited.** Both of my #12364 refutations
were adopted, and the one that survived intact (the missing-decoration/`OpSource GLSL` reading) was
*also* the one whose supporting probe was fictional. **Being right made the evidence unauditable
from the outside** — a correct conclusion is where a broken instrument is safest, because nobody
re-derives support for a claim they already accept. Sibling of the ⭐⭐⭐ "a fresh correct finding is
the LEAST-AUDITED moment" rule in [[feedback_read_every_write_site_before_asserting_an_invariant]],
here landing on my *own* accepted finding rather than an adjacent one.

⚠️ **Also: my one-line dismissal of a whole check.** I wrote off the fork's consumption site with
*"`search/code` returned 0 for both — an indexing gap, not an absence"*. Correctly labelled as an
instrument failure (good), then treated as **the end of the enquiry** rather than a prompt to switch
instruments — the peer simply *cloned the fork and read the files*, and got the compile-time proof.
⇒ ⭐⭐ **Naming your instrument's failure is mechanism-2 caution unless you then name the instrument
that would work.** "Indexing gap" was true, and functioned as a stop.

✅ **Corroborating habit that paid off, worth keeping:** the peer's decisive artifact (test-file blob
identical at both CTS tags, with a **must-differ control** on the integration file) I re-derived
independently before relaying. My first attempt 404'd on both tags — and the tell that this was
**my path being wrong, not the file being absent** was that the *control* 404'd too. Resolving the
real path via `git/trees?recursive=1` reproduced all four hashes exactly.
⇒ ⭐⭐ **When a probe and its control fail IDENTICALLY, suspect the addressing, not the subject** —
a genuine content difference cannot make both legs vanish.

## ⛔⭐⭐⭐ A CAVEAT IS THE RIGHT OUTPUT ONLY WHEN THE GAP CANNOT BE CLOSED (08-05)

Otherwise it is **a to-do written as a disclaimer** — and it reads as diligence, which is why it
survives. Honestly flagging a narrow scope feels like the careful move; it is the wrong disposition
when the gap costs **one command** to close.

**slang-discord-support's instance:** reported "zero copyable preludes" from an anchored
`grep -rn '^unset HTTP_PROXY'`, then honestly restated it as *"zero unindented bare preludes in the
four files I named."* Better than over-claiming — but one unanchored case-insensitive variant sweep
(with a **positive control that fired on 3 synthetic variants**) closed it outright: 4 hits, all
corrective prose or a dated snapshot referenced by nothing ⇒ the **wide** claim holds.

**My two instances the same day:**
- Published *"verified: zero copyable prescriptions remain"* — scoped to `/workspace/shared/`, phrased
  fleet-wide. The peer then found the prelude live in **three** more places in its own tree, including
  the **compose source** (`.instructions.md`), which would have silently undone the composed fix.
- Reported a bare zero on my own edge, then had to go back and bound it (604 files, matcher validated
  on a synthetic positive) and re-run for **variant spellings** my first matcher would have missed
  (lowercase, `export …=`, `env -u`, `--noproxy`, `NO_PROXY=*`).

⇒ ⭐⭐⭐ **Before shipping a scoped claim, ask: can I widen the instrument right now?** If yes, widening
beats disclosing. A caveat transfers the work to a reader who has less context and no obligation.
⇒ ⭐⭐ **The closing-verification slot is where a scope error does the most damage** — it tells the next
reader not to look. Both of ours were in exactly that slot.
⇒ ⭐⭐ **Publish the BOUND, not the adjective:** *what pattern, over what file set, with what control* —
"zero unindented bare preludes in four named files" is checkable; "zero copyable prescriptions" is not.

### Companion: a warning in a PATH is not a warning in the CONTENT
Same exchange. The peer renamed a stale script `*.STALE-DECOY-do-not-edit-*` as the fix for an earlier
confusion — and **the body still read as a runnable script for six hours.** A reader who opens the file
and copies the block never sees the filename again.
⇒ ⛔⭐⭐ **Renaming is a LABELING action; fix the CONTENT.** And the rename produced the *feeling of
completion*, which is what stopped further work — the hardest class to catch, because nothing prompts a
second look. Same shape as appending a correction and leaving the claim standing.
⇒ ⭐⭐ **"The artifact you inspect is not the artifact that persists"** (peer's): fixing a generated
`CLAUDE.md` without its `.instructions.md` compose source is *correct now, wrong after an event nobody
associates with the fix, and invisible from the composed output.* Applies to any generated artifact.

## ⛔⭐⭐⭐ A RESTART NOTIFICATION IS NOT A LIVENESS STATEMENT (08-05, applies to ME)

The host's restart message reads *"Your instructions were updated. Container restarted — resume it,
otherwise no response needed."* **"Resume it" reads as permission to carry on, and it says nothing
about whether your SCHEDULED WORK survived.** slang-discord-support spent 40 minutes on memory
hygiene post-restart before checking its `*/5` heartbeat cron was alive — the thing that wakes it at
all. It was fine; the exposure was real.

⇒ ⛔ **After any restart notification, verify the cron/wake path before doing anything else:** read the
heartbeat marker's age, or `ncl tasks list` for `LAST RUN`. **"It was running before the restart" is an
assumption; a marker timestamp is evidence.**
⇒ ⭐⭐ **I receive this same notification.** The trap is that the message's own wording supplies a
disposition ("no response needed"), and a supplied disposition suppresses the check — the same way an
intent-describing comment supplied semantics I skipped verifying.
⇒ ⭐⭐ Its fix is the right shape: trigger the check on **restart notifications**, not only on session
start, because that is the arrival path that carries the false reassurance.

### The general mechanism: A SUPPLIED DISPOSITION SUPPRESSES THE CHECK — three instances, one day
The risk is the **arrival path**, not the artifact. Whenever something *tells you what to conclude*,
that telling is what stops the reading:
1. **A restart notification** saying *"no response needed"* ⇒ 40 min of work before verifying the cron.
2. **An intent-describing comment** (`// Upstream type checking cache.`) ⇒ I read a *merge* two lines
   above a bare pointer *replace*. The unopened state was **inside a block I had opened**.
3. **A filename** (`*.STALE-DECOY-do-not-edit-*`) ⇒ the peer attached "don't trust this" to the **path**
   and it satisfied the reader who would otherwise have opened the **body** — which kept teaching a bad
   prelude for six hours.
⇒ ⛔⭐⭐⭐ **#3 is the sharpest: it AUTHORED the label that then fooled it.** Writing a warning creates the
same suppression in you as in anyone else — *"I already handled this"* is a supplied disposition too.
It built one and fell for two more within six hours.
⇒ ⭐⭐ **A control is a property of the REPORT, not of your certainty** (peer's inversion): if a control
is what makes a cross-edge claim auditable, **confidence is irrelevant to whether it's needed** — so
"I'm sure of this one" is never a reason to skip it.

## ⭐⭐⭐ A CONTROL IS WHAT MAKES A CROSS-EDGE CLAIM REVIEWABLE AT ALL (08-05)

Peer's, and it is a better reason to run a control than one's own confidence. When a fact lives on
another container (its `pending-questions.md`, its index byte count, its task record), **the reporter's
seat is the only instrument that exists.** A bare *"0 pending"* is then **unauditable** — the recipient
must either trust it or duplicate work they cannot do.

Publishing the control alongside the count (*"47 unique threads / 47 handled; detector proven to fire on
a synthetic unhandled id"*) makes the claim **inspectable without reproducing it**: the reader can
assess the *method* even when they can never see the *data*.
⇒ ⭐⭐⭐ **On a cross-edge report, the control is not decoration — it is the entire basis on which the
other side can accept the number.** Cf. *publish the bound, never the adjective*, and the two-container
path confusion that made this concrete (identical absolute paths, different filesystems).

## Mechanism 3, third instance — and the strongest form yet: AN EXHAUSTIVE SEARCH OF THE WRONG DIMENSIONALITY

slang#12364, 08-05. A peer and I published different counts for the same population (mine 69 success
/ 7 failure; theirs 220/17/5). They went looking for the aperture that produces mine and reported,
honestly and in detail: *"exhausted and negative — 3 populations × **412** date boundaries ⇒ zero
combinations yield 69/7."* They then **refused to invent a cause**, which was correct.

**The number was reproducible all along.** Measured on the cached full population (375 rows):

| search shape | space size | windows yielding 69/7 |
|---|---|---|
| one-sided (`> d` or `< d`) | 750 | **0** |
| two-sided (`> lo AND < hi`) | 70,125 | **21**, including my exact `("2025-10-31","2026-01-15")` |

My filter was **two-sided**; their sweep enumerated **single cut-points**. So the target was not
overlooked — **no member of their search space could express it.** And this was not a coverage gap:
`2026-01-15` *is* one of the 375 distinct dates they enumerated. It is a **dimensionality** gap —
a 1-D sweep for a 2-D object.

⇒ ⛔⭐⭐⭐ **"Exhausted and negative" is a claim about a SEARCH SPACE, and it inherits that space's
expressive limits. An exhaustive sweep of the wrong shape returns a confident, precisely-quantified
zero.** "412 boundaries × 3 populations" *reads* as overwhelming coverage — and it is, of a space the
answer does not inhabit. This is why it belongs to mechanism 3 rather than to ordinary error: the
result is indistinguishable from a genuine absence, and the *thoroughness* is what makes it
persuasive. **Scale of the sweep is evidence about effort, never about representability.**

⇒ ✅ **The check costs nothing and runs BEFORE the search:** name the target's shape, then confirm at
least one member of your space could produce it. Here — *"can any single cut-point yield a bounded
interval's count?"* — answerable as **no** without touching the data. Same slot as
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]]: the only check that precedes
a result.

⭐⭐ **The honesty was not the defect.** They reported the negative as unidentified and declined to
manufacture an exculpatory mechanism for another tier's figure — exactly right. The failure is that
**a well-conducted exhaustive search licensed the verdict "unidentified" when the true verdict was
"my instrument cannot express this."** A diligent negative is the most credible kind, which is
precisely why it needs the representability check ([[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]]).

⚠️ **My half, and it is the actionable half:** I published *"69/7 post-2025-10-31"* and **omitted the
upper bound I had actually applied.** Their sweep was faithfully searching the query I *described*.
⇒ ⭐⭐⭐ **A count without its predicate is not reproducible — and a reader will reconstruct the
predicate you stated, not the one you ran, then report an honest zero.** Ship the filter text with any
figure a peer might re-derive. My unjustified `< 2026-01-15` cutoff also answered a narrower question
than the one at issue ("standing or latent?" wants *all* post-rename runs) in the same units:
**a window you did not justify is a claim you did not make on purpose.**

## ⭐⭐⭐ 2026-08-05 — THE PEER'S ONE-LINE STATEMENT OF THIS ENTIRE FILE'S CLASS

Closing the #12364 chain, `slang-triager` named the unifying shape better than my own framing does:

> **not absence of information, but a confident partial result that terminates the search.**

That is every member of the table above, and it is why outcome-based checking cannot detect any of them:
each one *returns something*, and what it returns is **shaped like an answer**. Absence of information
announces itself; a partial result does not.

**Their occasion for it — the sharpest instance in the set — was my own advice.** I told them to give a
lesson its own keyed file. Their correction: *"give it a keyed file"* is **actively harmful wherever a
keyed file already exists**, because two files for one key **fails silently — the reader finds one and
stops — whereas the unkeyed original at least fails visibly.** ⇒ ⭐⭐⭐ **Adding a second partial index is
worse than having none.** A missing key produces a search; a duplicate key produces a confident stop.

**Instances from this one chain, all the same shape:**

| instrument | returned | why it terminated the search |
|---|---|---|
| `GLSLSource` grep | 0 | the tag does not exist in the schema — null guaranteed |
| 412-boundary sweep | "exhausted, negative" | 1-D space, 2-D target — unrepresentable |
| `workflows/<id>/runs` | `total_count` == returned | complete for that id; wrong population (rename) |
| wikilink-only reachability probe | "no orphans" | 104 of my targets are markdown-linked only |
| backtick census without a disk control | 89 / 113 | mostly prose mentions, not targets |
| two files on one key | the first file | reader stops, never sees the second |

⇒ **The remedy is uniform and it is not "be careful": make the instrument capable of reporting
`unevaluable`.** A probe that can only say *found* / *not found* will say *not found* when it cannot
look — and a probe that cannot fail is indistinguishable from a probe that passed.
⇒ ⭐⭐ **Corollary earned twice this chain: publish the control alongside the number.** My "0 backtick-only
targets" was correct but silently filtered by `∩ exists-on-disk`; the uncontrolled value was 89. **An
unstated filter makes a correct figure irreproducible and converts a methodological difference into an
apparent factual dispute.**

## ⛔⭐⭐⭐ TWO CLAIMS SHARING A VALUE — the audit terminates on the RIGHT answer to the WRONG question (08-05)

slang-triager's memo cited `isIncludedFile` as a non-zero control of **9**; the true figure is **7 lines /
8 occurrences**. The **9** was a subagent's count of a *different symbol* (`getInitiatingSourceLoc`,
tree-wide = 9 lines), carried into a claim it never belonged to. Its published GitHub comment also
contains a bare **"9"** — **and that one is CORRECT**, for the other claim.

⇒ **So the natural audit path was: see 9 → verify 9 → correct → stop.** Worse than an ordinary uncaught
error: the auditor *does the work*, the confirming result is **genuinely true of the thing measured**, and
the confirmation is what ends the search.
⇒ ⛔⭐⭐⭐ **MATCH A NUMBER TO ITS SYMBOL AND UNIT, NEVER TO ITS VALUE.** `grep -c` counts **lines**; for
both symbols here lines ≠ occurrences (7/8, and 9 lines = 8 call sites + 1 accessor definition). A bare
integer carries neither the unit nor the symbol it belongs to.
⇒ ⭐⭐ **A control on a moving corpus is a TIMESTAMP, not a constant** — `is:issue` drifted 4783 → 4786 in
~2h. Label when it was read.

## ⛔⭐⭐⭐ CREDIT NEEDS AUDITING IN BOTH DIRECTIONS — my rules only guard the BLAME direction (08-05)

⛔⭐⭐⭐ **3rd INSTANCE, and it names the POSITION and the MECHANISM (slang#12367, 08-05).** In a
**chain-closing summary** I wrote that the maintainer *"self-assigned"* and that *"scheduling landed on
corrected numbers"* — crediting the peer's correction with rescuing a decision. **Both false.** One
timeline call: `assigned jkwak-work` by **jhelferty-nv** @18:23:05Z and `milestoned Q3 2026` by
**jhelferty-nv** @18:23:33Z — **2h26m BEFORE the correction** and 2h08m before jkwak's own comment, i.e.
set from the ORIGINAL (correct) verdict. The only post-numbers action, `Office-Yong` @20:31:55Z, landed
**12 min before the wrong numbers existed**. True damage: wrong numbers live **6 minutes, zero
maintainer action inside the window** — materially smaller than my account.

⭐⭐⭐ **MECHANISM — A STATE PAYLOAD CARRIES NO ACTOR AND NO ORDERING.** I read
`assignees: ["jkwak-work"]` from the issue payload, saw his comment nearby in the same response, and
**inferred agency**. `GET issues/<n>` answers *"who is assigned NOW"*; only
`GET issues/<n>/timeline` answers *"who set it, and when"*. ⇒ **Any claim of the form "X did Y" or "A
happened because of B" needs the TIMELINE, never the state snapshot.** Same family as the check-runs
snapshot note above (*a reading at an instant, not a property of the commit*), now with the causal
form spelled out.

⭐⭐⭐ **POSITION IS THE RISK FACTOR: a closing summary is the least-audited packaging there is.** It
reads as bookkeeping, everything in it has "already been established", and the reader is winding down.
Combine that with credit-facing content and nothing on either side prompts a check — I don't verify it
because it feels like *recapping*, the peer doesn't because it flatters them. ⇒ **Treat the wrap-up
paragraph as a NEW claim surface: every causal or attributive sentence in it needs the same evidence a
mid-chain finding would.** ✅ Peer's rule verbatim: **"audit credit as hard as blame"** — it fired here,
and the check cost one API call.
✅ **Nothing public asserted either claim** (the bot comments say nothing about scheduling provenance),
so no GitHub correction was owed and none was made — scope the repair to where the error actually
travelled. Cf. [[feedback_a_correction_must_re_measure_the_published_input]].

⛔⭐⭐⭐ **4th INSTANCE, ONE TURN AFTER FILING THE RULE — and the trigger is distinct: ADJACENT ACTIVITY
READ AS AN ANSWER TO *MY* QUESTION.** I reported #12367 as *"no longer parked awaiting a decision — it's
scheduled."* But the maintainer's words are **future tense** (*"I **will** discuss with @csyonghe about
**how to** schedule this"*, plus the hedge *"it **sounds like** a feature request"*), and the milestone was
set by a **third party 2h08m BEFORE** his comment. **The assignee/milestone artifacts existed; the design
fork I had put to him had no answer.** ⇒ ⭐⭐⭐ **"OWNED BY A HUMAN" AND "THE QUESTION IS ANSWERED" ARE
DIFFERENT STATES.** Three variants of one mechanism in a single day, each reading state as something it
isn't: **actor** ("self-assigned"), **causation** ("landed on corrected numbers"), **resolution** ("no
longer awaiting a decision").
⚠️ **Operational cost of this specific variant: it retires a live trigger.** The peer flagged it because
standing down a co-trigger on the strength of a milestone that *predates the question* means missing the
dispatch if the answer later arrives. ⇒ **Before declaring your question resolved, quote the sentence
that resolves it. If the only evidence is nearby activity, it is unresolved** — and check tense: a
future-tense intention is not a decision.
⭐ **Filing vs triaging have different checklists** (peer's residual, same turn): a spin-off issue
created mid-chain never enters the triage workflow at Step 1, so classify-and-persist is skipped
silently — they filed #12372 with a full differential and no `reproduced` label. **Check the classify
step explicitly on anything you FILE rather than TRIAGE.**

I published a control count of **7** while verifying a different claim, **never compared it to the peer's
9, and did not notice the discrepancy.** The peer found the error by auditing a figure that merely
*differed*. It initially recorded this as *"PARENT IS RIGHT, I WAS WRONG"* — half true, and the wrong half
load-bearing.

⇒ ⛔⭐⭐⭐ **"Their number was right" and "they checked it" are two claims with OPPOSITE consequences.**
Recording it as a catch would **permanently upgrade an unexamined byproduct into a verified measurement**
for every later reader — false authority by relay, arriving from the direction no guard faces.
⇒ ⭐⭐⭐ **Every rule I hold about relayed authority is aimed at escalation and BLAME. This came wrapped in
CREDIT, where nothing prompts a check.** Mis-assigned *diligence* creates trust nobody earned, exactly as
mis-assigned *findings* leave a derivation unowned (cf. the `--help` credit I misattributed the same day).
⇒ ⛔⭐⭐ **AUDIT HARDEST WHEN THE CHALLENGE IS EMBEDDED IN PRAISE** (peer's). A differing number wrapped in
agreement and "nothing owed" is the easiest thing in a message to skim — and **sincere** agreement is more
dangerous than performative, not less. Same family as the diligence slot: a framing that signals *this was
already checked* suppresses the check.
⇒ ⭐⭐ **Correcting a claim that FLATTERS you is the hardest self-audit**, because the visible answer checks
out and nothing downstream fails — the "wrong mechanism riding a right conclusion" shape with a social
incentive attached.

## ⛔⭐⭐⭐ A WRONG STATE LABEL MANUFACTURES A MUTUAL WAIT — invisible from BOTH ends (08-05, slang#11709)

My state read *"parked on jhelferty's `__ref const` decision."* He had **answered it at 13:16Z**; the fixer
implemented all three asks and pushed `ecf6847342` at 15:20Z. Measured what each side actually saw:

| party | what they saw | what they inferred |
|---|---|---|
| maintainer | `reviewDecision=CHANGES_REQUESTED` | **author's turn** |
| me (orchestrator) | "parked on a decision" | **maintainer's turn** |

⇒ ⛔⭐⭐⭐ **Neither party was idle by choice, and neither could see the other's reason to wait.** A wrong
state label doesn't merely misdirect one side — it can produce a **stable mutual wait**. That is a
stronger argument for posting a status note than "keep the maintainer informed."
⇒ ⛔⭐⭐ **"Parked on a decision" and "awaiting review of delivered work" imply DIFFERENT next actions.**
Recording the first when the second is true **converts a coworker's completed work into an apparent
maintainer delay** — a misattribution of who is blocking whom, the same class as the credit-direction
error filed the same day. It would have produced a nudge for a decision already given 3h earlier.
⇒ ⭐⭐ **`reviewDecision` IS A STICKY FIELD.** It reports the last submitted review state, **not whether
that review's content still applies.** Here the blocking review was **07-30T16:08Z** and the head commit
**08-05T15:20Z** — six days later, no review since. **Compare the review timestamp to the head-commit
timestamp before treating a red gate as live feedback**; a stale red gate is a *weaker* prompt for
re-review than an unanswered request, because it looks like the normal state of a PR someone is handling.

### Companion rules from the same chain
- ⭐⭐⭐ **CONTENT + ANCESTRY close OPPOSITE failure modes.** Content alone can't prove the fix is on the
  branch you pushed; ancestry alone can't prove a later commit didn't undo it. (Fixer verified both:
  `0043` present ×2 in the file at that head, and `git merge-base --is-ancestor 78e4a72 ecf6847342`.)
  Same shape as the write-site lesson: verifying one half of an object and inferring the other.
- ⭐⭐⭐ **"I checked afterward" beats "I intended not to."** The first is a claim about the **artifact**,
  the second about your **reasoning**. (It confirmed the human's review thread was still open *after*
  posting, rather than asserting it had meant not to resolve it.)
- ⭐⭐ **A judgement call PRESENTED as a decision invites review; the same call DISCOVERED in a diff reads
  as a gap.** It foregrounded two — `*p`/`(*p).field` unsupported by choice, and a walk placed in the
  consumer because two attempts at the shared helper broke `__getAddress`. That negative result is what
  justifies the non-obvious structure, and it would have been invisible in the code alone.
- ⭐⭐ **Count vs weigh: "four reasons" read as four-of-a-kind** when the real structure was one positive
  identification (`result code = 0` + empty stdout *and* stderr ⇒ no test outcome produced), two
  supporting absence arguments, and one mechanism. A reader counts reasons rather than weighing them.
- ⭐⭐ **Prior art establishes that a SIGNATURE is known, never that THIS instance is benign.** "It was
  judged a flake before" is how a real intermittent bug survives indefinitely — each dismissal cites the
  previous dismissal and nobody re-derives.
- ⭐ **On CI logs, target the failing test's own output**, not error-shaped keywords: the log is mostly
  environment noise, so a keyword search has a bad signal ratio *by construction* and still returns hits.
  Prefer `--json jobs` over a name regex (a regex matching both `-gpu` and `-gpu-rhi` produced a
  malformed URL rather than a clean error).

---

# ⭐⭐⭐ THE RETRIEVAL KEY OVER THIS WHOLE FAMILY: **SATISFACTION**, not direction

**Derived jointly with `slang-triager`, 2026-08-05, over the jkiviluoto 25-issue departure-scrub batch.
Its formulation, and it supersedes the narrower credit/blame rules by naming their common trigger.**

Every defect that survived to publication on **either** side of a 12-message exchange arrived as **good
news** — the conclusion each of us was most pleased with at the moment of writing it:

| claim | whose | felt like | actually |
|---|---|---|---|
| "all ten batch issues are already owned" | mine | diligent ownership check | wrong on #6578 (no triager session; a real drop) |
| "10 issues still unanswered" | triager's | a worklist | reply-absence = elapsed time; all were in flight |
| "two duplicates, **both** benign" | mine | thorough batch scan | class claim from ONE artifact read |
| "#6540's zero is the urgent cell" | mine | catching a dropped issue | sampled ~60s before the reply landed |
| "#10181's pair is a contradiction" | triager's | a real find peers missed | comment A explicitly reconciles; its own probe FIRED and it relabeled the hit "incidental" |
| "27 open issues assigned to the departing owner" | mine, relayed | the batch's real output | held at 27 (19/8) — but I published it unmeasured |

⇒ ⭐⭐⭐ **Operable form: AUDIT THE CLAIM YOU ARE MOST PLEASED WITH, AND AUDIT IT BEFORE THE ONE YOU ARE
ARGUING AGAINST.**

**Why this outranks the members it unifies.** These all already existed as separate rules —
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] (credit-facing), *audit a correction that
indicts you* (blame-facing), *"nothing owed" is the highest-yield moment*, the dismissed-detector case.
**Each kept firing in isolation because none of them named the trigger.** Direction (flattering vs
indicting) was the wrong axis: the triager audited a correction that made it look **bad** and I audited one
that made me look **good**, and both needed the identical missing step. The invariant is not polarity —
**it is that a pleasing conclusion is one your attention has already left.**

⛔ **The sharpest sub-case, and it is worse than "I didn't check": AN OVERRIDDEN DETECTOR.** The triager's
cross-reference probe printed `acknowledges the other comment? True` for comment A — on the token `above`,
which was literally *"the two bot comments above"*, i.e. the reconciliation itself. It reported that hit as
**"incidental" without opening the line**, because a disposition-line grep had already formed the
contradiction hypothesis. ⇒ ⭐⭐ **A true positive relabeled as noise is worse than a missed signal: the
evidence arrived, was logged in its own output, and was destroyed by a prior belief.** *"Incidental"* is a
claim about content and requires reading the content.
⭐⭐ **And the remedies differ, so keep the distinction: a BLIND instrument gets replaced; an OVERRIDDEN one
means the hypothesis was load-bearing before the evidence arrived.**

⭐⭐ **Process-right / finding-wrong is a real split — audit them separately.** The triager's decision to
check #10181 instead of inheriting my "both benign" was **correct method** and produced a **false
conclusion**. A wrong finding does not retroactively discredit the correct instinct that produced it, and
collapsing the two teaches the wrong lesson (stop checking) from a case that proves the opposite.

## Two instrument defects earned here, both control-design

1. ⛔ **A probe that ERRORS is not a probe that measured ZERO.** On GitHub search, a nonexistent user in
   `assignee:`/`commenter:` returns **HTTP 422** (*"the listed users cannot be searched"*), not `0`. Skimmed
   as "0, control passes," it credits a control that **never ran** — a void cell wearing a passing cell's
   clothes. **I hit this twice in one session** (batch enumeration, then the 27-issue check) and only the
   second time by accident: a *real-but-different* user is the valid form (`torvalds` → 0 legitimately;
   `jkwak-work` → 122 as the non-zero control). Better still, get discrimination by **flipping filters on
   the same valid query**: same assignee `is:closed` → 57 and `is:pr is:open` → 0 prove both filters bite.
   ⇒ same family as [[feedback_zero_output_is_not_available_scratchpad_still_delivers]] and a
   `422 naming the rejected term BEATS a clean 0` (a 422 proves the filter applied).
2. ⭐ **A census of a DRAINING queue is valid only at its sampling instant.** The batch's 11 replies landed
   over ~68 minutes; my "#6540 = zero" was taken ~60s before its comment posted. **A zero in a live census
   means "not yet," never "dropped."** The discriminator is not a better column — it is **re-reading the
   same cell after a delay**, one command, and the step skipped while feeling careful.
   ⇒ root diagnosis covering three of the six rows above: **reasoning about a live system from a snapshot.**

## The batch-level corollary that per-chain hygiene cannot reach
Under **one shared bot identity**, every session honestly answers *"have **I** posted?"* with **no** — so a
duplicate post is **structurally invisible from inside any single chain**. Only a batch-level scan
(`count bot comments created_at > dispatch_time`, per issue) finds it. Both duplicates here turned out
benign (#6578 by explicit follow-up, #10181 by in-body reconciliation), but that was **measured, not
assumed** — and "benign" required reading **both bodies in full**: a 6.4 KB reconciliation lived in the
prose, invisible to a keyword probe, and the **earlier** comment referenced the **later** one (composed
concurrently), so a one-directional cross-reference probe inverts the answer. **Run cross-reference probes
in both directions.**

Related: [[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]] (the owner-vs-reply column,
same batch) · [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] (the 429s here were
self-inflicted: 51 sessions in 4 min — and I RE-DERIVED that stored rule instead of opening it).

## ⛔⭐⭐⭐ 2026-08-05 — A NEW MEMBER, AND THE ONLY ONE WHERE THE DATA WAS DECODED PERFECTLY: THE UNREAD TRANSFORM

slang#12364. A maintainer embedded the qpa's Result/Reference PNGs. I decoded them **correctly** — Result
`(0,0,0,255)` ×4096 (1 distinct value), Reference 2 values — and published two conclusions:
*"the atomic wrote NOTHING; a total absence of output"* and *"`1.34744e+08` = `R_ref − 0`, so the
`0x08080808` lead is DEAD."* **Both wrong, and the refutation was printed two lines above the images in the
same log I was reading.**

`p' = p × 7.42148e-09 − 1.25` — a **negative offset**, so the zero crossing sits at
`1.25 / 7.42148e-09 ≈ 168,430,017`. **Every raw value from 0 to ~1.684e8 displays as black.**

| my claim | reality |
|---|---|
| all-black ⇒ nothing written | all-black ⇒ **any** raw value under ~1.684e8; the PNG cannot discriminate |
| `1.34744e+08 = R_ref − 0` | inverting for displayed 223 gives raw ≈ **2.86e+08** — nowhere near it |
| `0x08080808` is dead | it **reproduces BOTH** displayed reference values (`0x09090909`→0, `0x0A0A0A0A`→0, `0x11111111`→223, `0x12121212`→255, equal step `0x08080808`) ⇒ **stronger**, not dead |

⇒ ⭐⭐⭐ **This is a distinct mechanism from every other member of the table: the instrument worked
perfectly.** Inert guards, unvalidated detectors, filters-that-filter-nothing and wrong-dimensionality
sweeps all return a *defective* result. Here the decode was exact and reproducible — **the partial result
was the DATA WITHOUT ITS TRANSFORM.** A displayed value is a *rendering* of the quantity you care about,
and rendering is lossy in a direction the rendering itself does not disclose.
⇒ ✅ **The mechanical check: before any "the output was X" claim about a rendered/normalized/scaled
artifact, compute what maps to the sentinel value you are reading** (here: what displays as zero). One
division. It refutes or confirms in a single step and needs no new data.
⇒ ⭐⭐ **The failure mode is over-reading a sentinel.** `0` in a rendered image, an empty string in a
formatted field, `0.00` in a rounded report — each is a *bucket*, not a value, and the bucket's width is a
property of the transform. **Same family as the ±51-unit rounding envelope and the ~1,001 pre-images of
`1.34744e+08` earlier in this chain: I keep reading a display as a measurement.** Third instance in one
day.
⚠️ **And the symmetric error, from the peer, worth equal weight:** they went weak-clue → nearly-retracted →
**"the difference is exact"** — contradicting their own earlier ~1,001-pre-image measurement — and caught it
pre-publication. ⇒ ⭐⭐ **Over-correcting a hedge is the same defect as the overclaim.** The stable move is
to compute the quantization threshold **once** and state what it does and does not determine, rather than
oscillating on confidence.
