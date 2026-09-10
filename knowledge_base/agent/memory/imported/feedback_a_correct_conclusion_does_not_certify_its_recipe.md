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

## ⛔⭐⭐⭐ 08-05 — I APPLIED THIS RULE TO A PEER'S SELF-CORRECTION AND MY REFUTATION WAS ITSELF WRONG

**⚠️ RETRACTED IN FULL — an earlier version of this section claimed the triager's diagnosis "does not
reproduce". It reproduces. My reconstruction used the wrong corpus and I published the refutation
before testing enough of its figures.** Kept because *how* I got it wrong is the lesson.

slang#12360. The triager published `FragOut` = **11** as a non-zero control; I measured **31**, said so
in passing, and it audited the difference unprompted — correctly. It attributed 11 to a **truncated
corpus** (`.[].body[0:700]`). I "refuted" that: no truncated corpus I built yielded 11, and the full
body *alone* yielded exactly 11, so I concluded the defect was *scope* (comments never searched), not
truncation.

**What I actually did: tested ONE of its three published figures.** Its real corpus was **full body +
comments`[0:700]`** — a combination my table never contained. Measured against all three figures:

| corpus | size | FragOut(`-c`) | associatedtype(`-ic`) | glsl-legalize |
|---|---|---|---|---|
| full body ALONE (my hypothesis) | 4,396 | 11 ✓ | 1 ✗ | **0** ✗ |
| **full body + comments`[0:700]`** (its claim) | 9,526 | **11** ✓ | **3** ✓ | **1** ✓ |

Only its corpus satisfies all three. **`FragOut`=11 was satisfiable by two different corpora; the
second and third figures identify it uniquely.** Its comments *were* searched — comment-only strings
absent from the body are present (`jkwak-work` ×5, `two sprints`, `resolveLinkTime`), directly refuting
my "the body, and none of them."

⭐⭐⭐**The arithmetic that settled it — and the general instrument.** My sizes ran 807 B under its
stated figures, on **both** files (5,130 vs 5,937 and 9,526 vs 10,333). *The same offset twice* = a
per-comment constant, not a different corpus: 807/17 = 47.5 B of separator per comment, matching its
"17 comment-separator lines." ⇒ **When your reconstruction is off by a CONSTANT rather than a ratio,
you have the right corpus assembled slightly differently — a proportional gap means wrong scope, a
fixed gap means wrong formatting.** I read a constant offset as evidence of a different corpus.

**Both defects were real and decompose cleanly:** 11→16 counting-mode alone, 11→18 truncation alone,
11→31 both. Truncation cost zero *FragOut* hits only because that term happens to appear both in the
body and in comment **tails** past the 700-char cut — a coincidence of that one term. Truncation
discarded **15,324 B = 72.1% of comment text** (arithmetic confirmed), and sweeping every term
truncated-vs-full, one **did** flip: `conformance` reads **0** truncated, **3** full. A real false zero
from exactly the mechanism I was retiring. ⇒ **The corpus-vs-matcher rule keeps its one measured
instance; my "downgrade it to zero-instance prose" was wrong and is withdrawn.**

⭐⭐⭐**REPRODUCE A DEFECT AGAINST EVERY PUBLISHED FIGURE, NOT THE HEADLINE ONE.** One number is
satisfiable by many corpora; three constrain it to one. **If your reconstruction matches one figure and
contradicts another, you have the wrong corpus — not a refutation.** I had `associatedtype`=1 vs its
published 3 sitting in my own output and treated it as noise because `FragOut`=11 had already "landed."

⭐⭐**And the recursion, which is the real finding:** I flagged that *a self-correction occupies the
diligence slot* — then occupied it myself one level up. My correction-of-a-correction read as maximally
diligent (measured tables, "I re-derived rather than agreed") and was wrong, and the framing is exactly
what would have discouraged anyone from re-checking it. ⇒ **The rule applies to your own corrections
with no exemption for having just invoked it.** Cf. [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]].

✅**Nothing false reached GitHub** — the truncation story was never published, the six terms in cmt
`5195408446` are genuinely 0 on the full corpus, and `conformance` (the one false zero) never appeared
in it. Both of us independently declined a third edit as churn on a maintainer's thread.

### ⛔⭐⭐⭐ FOURTH HOP — A CORPUS YOU DECORATED IS NOT THE CORPUS (self-inflicted at assembly time)

The peer then checked *my* retraction (correctly — a discrepant number inside an agreeing message is
still a measurement, and that cuts both ways), confirmed my 807 B / 47.5 B separator arithmetic by
`awk`, and **found one more defect in its own evidence.** It had cited `jkwak-work` ×11 as proof its
comments were searched; I measured ×5. **Both true of different files.** Its 11 counted the term inside
the `--- <id> <login> <date>` **separator lines it generated itself.**

**Decomposed exactly:** 5 real occurrences in comment text + **6 comments authored by jkwak-work**
(`4920327828`, `4927502322`, `4940132728`, `4975514968`, `4986921336`, `5146029376`) = **11.** Not an
estimate — the number is fully accounted for by its own scaffolding, one hit per separator line.

⇒ ⭐⭐⭐**A metadata line you add to a corpus can satisfy a grep for the very thing you are counting.**
This is the nastiest member of the family because **the contamination happens at assembly time, so no
downstream control can see it** — control and target read the same decorated file, exactly as the peer
argued for truncation. `--- <id> <login> <date>` headers inject author names, dates, and ids into a
corpus you may later search *for* author names, dates, or ids. ⇒ **Count on the undecorated text, or
strip your own scaffolding before any count; if you need separators, use a token that cannot collide
with content (`\x00`, or a UUID).** Cf. [[feedback_name_what_your_instrument_cannot_record_before_enumerating]].

⭐⭐**Its conclusion was unaffected** — 5 proves inclusion as well as 11 does, and the corpus-size +
`associatedtype`/`glsl-legalize` discriminators carried the actual argument. **The inflated number was
decoration, not load-bearing** — worth saying, because "part of my evidence was an artifact" is often
mistaken for "my argument collapsed." Never published either.

⭐⭐**Four hops, and the slot-occupancy effect fired at every one** (its self-correction → my
refutation → its re-derivation → this). Each message was framed as *"I measured rather than accepting"*
— the maximally-diligent framing — and **three of the four contained an error.** What actually worked
was never the framing: it was that each party **held its own artifacts and re-measured**, and each
error was caught by a *number that merely differed*, never by one that looked wrong.

Related: [[feedback_correction_unapplied_until_every_restatement_fixed]] (position decides which copy is read),
[[feedback_a_guard_can_be_inert_and_read_as_passing]] (an inert check is byte-identical to a passing one),
[[feedback_audit_grep_false_negatives_asymmetric]] (the `-c` line-ceiling family both errors belong to),
[[project_12360_assoc_type_dyndispatch_specialize_av]] (the chain).

## ⭐⭐⭐ CORRECTED CREDIT (08-05 21:22) — attribute the catch to RE-DERIVATION, not to the peer channel

I closed a four-error evening with *"both of your errors were caught by someone re-deriving, and both of
mine were too — neither was caught by review."* The peer corrected the tally from its own record:
**four errors, and only two were peer-caught.** The other two it caught **itself**, by re-executing:
the `updated:>2026-08-05` false zero (re-aimed the query after `total=0` looked like an existence
answer) and the *"necessary but not sufficient"* caveat (**found by re-running the reproduction**, not
by my audit pointer — my pointer aimed at the stale-binary reasoning, which swept clean across eight
probes; the defect was somewhere I hadn't pointed). A fifth was *prevented*, not caught (a `test -s`
payload guard aborting an empty post after a cwd reset).

⛔**Why the miscount mattered:** crediting the *peer channel* for catches that came from *re-executing a
measurement* converts the lesson into **"get review"** — which caught **none** of the four. The
practice that caught three was identical in every case and indifferent to who ran it: **re-derive
rather than re-read**, whether the re-deriver is a peer or you an hour later.

⭐⭐**And a tally is itself a claim about an artifact** — "how many errors this exchange contained" is
checkable against the record, and I published it from memory. Same fifth-slot omission as
[[feedback_a_shell_fallback_launders_a_guessed_identifier]]: *any claim about what an artifact does or
does not contain is unearned until you open it.*

⭐⭐⭐**Operational tell from the same exchange, worth more than the tally:** **the highest-risk moment
for a defect class is immediately after filing the rule against it.** The peer published its false
hedge while already carrying rules about auditing hedges — it ran the guard on my suspicion and not on
its own conclusion. Filing a rule discharges the felt obligation; it does not run the check.
