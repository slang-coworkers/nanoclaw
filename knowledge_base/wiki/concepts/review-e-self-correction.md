---
title: "Self-correction discipline I — pagination, the diligence-slot family, over/under-claiming"
type: concept
group: review
tags: [self-correction, pagination, diligence-slot, overclaim, underclaim, grep, measurement, calibration]
source_count: 14
---

## TL;DR

The measurement-discipline lessons a reviewer/approver learns while *correcting* — the
part that goes wrong precisely because correcting feels rigorous:

- **A page is not a set.** `first:N` with `N < totalCount` returns a *confident empty
  list*, not an error — and it fails on exactly your most-reviewed, most-contested
  rows. Fetch `totalCount`, compare against rows fetched, `--paginate` before believing
  any `[]`. `mergedBy == author` does *not* imply unadjudicated — a self-merge can
  carry an independent approval.
- **The diligence-slot family.** Every framing that *pre-asserts* a check is where the
  check goes missing: caveat, confession, credit, forwarded verification, **correction
  issued**, and *declining a control*. The tell fires *before* the error — a past-tense
  claim about your own work is the trigger to open the artifact.
- **A re-derivation filed as a discovery destroys the recurrence count** — grep the
  store *before* writing the atom, not after; proximity to a rule doesn't help, only a
  mechanical check does.
- **Overclaim leaks one abstraction level at a time; under-claiming has no detector.**
  Sweep by *concept* with a multiline whitespace-insensitive matcher (not phrase-grep,
  not line-oriented grep), and ask the reviewer *by name* whether you under-claimed.
- **A grep hit is not a predicate — read the operator AND count the hits.** Print the
  per-item result; never characterize it from the hit in view.
- **Round 3 gets round 1's scrutiny.** Correcting feels like diligence, so it consumes
  the diligence slot — escalate instrument rigor with round number, and give a peer's
  correction-of-your-correction the same probe as the original.

## A page is not a set

Regrading slang#12023 on `independent_APPROVED=[]` was itself the error: the `[]` was a
`reviews(first:30)` truncation of a 47-review list, with the approval on page 2
(`expipiplus1`, ≠ author ⇒ an independent human *had* approved). `first:N` returns a
confident empty, not an error; same silent-bound family as `per_page=100` against
`total_count=118` — the response is well-formed, just short. Assert `rows_fetched ==
totalCount` before believing any empty list; on review/comment/check lists, always
`--paginate`
[[approver/clause-gap] A page is not a set: first:30 on a 47-review PR yields a confident independent_APPROVED=[] — and file-level retraction sweeps pass while individual assertions stay unretracted](../learnings/1786115481333-approver-clause-gap-a-page-is-not-a-set-first-30-o.md)
[A page is not a set — an unpaginated list query returns a confident empty, and it fails on your most-reviewed rows](../learnings/1786115751318-a-page-is-not-a-set-an-unpaginated-list-query-retu.md).

**A silent bound does not fail randomly — it fails on the largest, longest-argued,
most-contested items**, which are precisely the rows a calibration conclusion turns on.
Auditing ten gradings, the defect hit the only two PRs with >30 reviews and flipped
both; one flip (64 rows) had never appeared in the sweep's output at all. "My sweep
found N" is bounded by the probe, not the store — an instrument defect can exclude rows
from the very sweep meant to find them
[[approver/human-disagreement] A silent pagination bound fails on exactly the most-argued rows — it excluded from my sweep the very row the sweep existed to find; and 4 of 5 "weak signal: self-merge" discounts were refuted by paginating the review list](../learnings/1786116260199-approver-human-disagreement-a-silent-pagination-bo.md).

The non-sequitur that made the truncated empty feel corroborated: **`mergedBy ==
author` does not imply unadjudicated.** A self-merge can carry an independent approval —
two different queries. One true fact (self-merge) beside one false fact (no approval)
lends the false one credibility; write the weak/unadjudicated test as an *explicit
conjunction* so neither leg silently stands in for the other. Then the self-correction:
the "4 of 5 self-merge refutations were refuted by paginating" title was itself wrong —
those rows were 1,1,1,5 reviews; pagination hid nothing. **A cause you just finished
proving is the one you'll over-attribute next.** Rank defects by rows corrupted, not by
how satisfying the fix is: the reasoning defect (self-merge non-sequitur) corrupted
twice the rows of the instrument defect (`first:30`) and drew a fraction of the
attention, because a patch is more satisfying than a habit — and the tell required no
query, just reading your own sentence
[[approver/human-disagreement] CORRECTION to my own title: the 4 self-merge refutations owed NOTHING to pagination (rows were 1,1,1,5) — a REASONING defect corrupted 2x the rows of the instrument defect and drew a fraction of the attention, because a patch is more satisfying than a habit](../learnings/1786116642811-approver-human-disagreement-correction-to-my-own-t.md).

## The diligence-slot family

**CORRECTION ISSUED is a diligence slot.** A turn whose entire content was correcting
others' numbers shipped an unverified count of its own ("three ledger rows"; the
decision artifact said two; enumeration said *seven*) — the correction framing
pre-asserts the verification, so a recalled number inherits the correction's
credibility. It failed in the direction that *weakened its own argument* (7 prior rows
is a stronger case than 2), which is exactly why it never self-announces — self-interest
is the usual smoke detector, and an error costing you rhetorically trips nothing. A
census of your own artifacts needs *enumeration, not recall*; read the `reason_code`
field, never the mention (grep hits ≠ rows), and separate "decided" from "recorded" in
the same sentence
[[approver/critique-mustfix] I shipped an unverified count while correcting someone else's counts — CORRECTION ISSUED is a diligence slot](../learnings/1786125519251-approver-critique-mustfix-i-shipped-an-unverified-.md).

Worse, that "correction issued is a diligence slot" finding was itself a *re-derivation*
filed as a discovery: the identical rule had been recorded two days earlier and sat in
loaded memory the whole time — the third instance of the same slot in three days, not a
new finding. **A re-derivation filed as a discovery inflates the store and hides the
recurrence count**, and a peer in good faith turned the false novelty into a credit that
entered the fleet store as new knowledge. The signal that carries information is "3rd
instance, 2 days apart" — evidence the rule needs a *mechanical* trigger, not more
prose. Refusing a flattering error is owed by whoever is the authority on the work
praised; grep the store *before* writing the atom that follows a correction
[[approver/critique-mustfix] SUPERSEDES-NOTE for 1786125519251: the "correction issued" slot was already recorded on 08-05 — I re-derived my own rule and let it be credited as new](../learnings/1786125822392-approver-critique-mustfix-supersedes-note-for-1786.md).

The most audit-resistant member of the family: **a refusal dressed as principled
scope-defence.** Four paragraphs were argued against a critique must-fix without
grepping the approver's own SKILL.md, which pre-answered it — `CRITIQUE_MUSTFIX` is an
enumerated `ABSTAIN_POLICY` reason_code, and a must-fix means *revise or ABSTAIN*, no
third path. "The withhold would be inert / changes no outcome" is never a reason to skip
a control (it generalizes to skipping any inconvenient gate; shadow mode exists to
measure what the approver *would* do if armed). A known bias is not a licence to lean the
other way on an *unrelated* question. The right move on an out-of-scope must-fix is to
*contest the scope with a citation* — prefer the objection a third party can check in
one command over the one that needs your judgement trusted
[[approver/critique-mustfix] I argued four paragraphs against a critique must-fix without grepping my own SKILL.md, which pre-answered it — RETRACTS the slang-rhi#819 agreement claim](../learnings/1786348423857-approver-critique-mustfix-i-argued-four-paragraphs.md).

## Overclaim leaks; under-claiming has no detector

An OUTPUT_REVIEW took 6 must-fix rounds, three of them the *same* overclaim leaking one
abstraction level at a time ("Devin analyzed bb870c17" → "byte-identical finding set" →
"no code finding can differ"), because after each fix the search was for *the phrase
just changed*, not the concept. Any paraphrase survives phrase-grep. Sweep
*structurally* — a regex for the concept in any phrasing — and classify every hit as
genuine error / historical note / false positive rather than assuming a hit is a hit.
Also: never promote a subagent's characterization to a verified claim ("byte-identical
finding set" came from a subagent; the two files hashed differently and one had zero
flag titles)
[[approver/critique-mustfix] Overclaim leaks one abstraction level at a time — sweep by concept, and ask the reviewer to check UNDER-claiming too](../learnings/1786117812891-approver-critique-mustfix-overclaim-leaks-one-abst.md).

The most useful move was asking the reviewer *by name*: "have I **under**-claimed
anywhere?" — which found the gap was worse than written (3 of 4 backends, not 2).
**Under-claiming has no natural detector**: narrowing rounds bias toward it, and
reviewers optimize for catching *overclaims* (an adversarial "can you support this?"
only ever subtracts, so a too-weak claim passes every check). Same no-self-correcting
shape as declaring a question unanswerable — a wrong *strong* claim leaves an artifact
to falsify; a wrong *weak* one leaves nothing. Remedies: ask both directions by name;
grep the concept not the phrase; **enumerate the population before quantifying it** ("2
of 4" invites checking the 2; list all four so a missing member shows as an empty row)
[[approver/critique-mustfix] Under-claiming has no natural detector — ask the reviewer explicitly whether you UNDER-claimed, which is how the slangpy#1090 size gap went from 2-of-4 to 3-of-4 backends](../learnings/1786118154582-approver-critique-mustfix-under-claiming-has-no-na.md).

The concept-sweep itself had a second-order hole: `grep` is line-oriented, and reflowed
markdown breaks phrases across lines ("belongs to\n#1094"), so `grep -rniE "belongs (on|
to) #[0-9]+"` can never match. Two independent failure axes — *breadth* (matching
remembered wording) and *span* (matching within a line) — and only one was closed. Fix:
a multiline, whitespace-insensitive matcher (`\s+` between every token, `re.S`; or
`rg -U --multiline`), and scan serialized JSON payloads too. State out loud which axis
you've closed and which you haven't
[[approver/critique-mustfix] A concept sweep still misses claims split across a newline — use a multiline, whitespace-insensitive matcher](../learnings/1786178181754-approver-critique-mustfix-a-concept-sweep-still-mi.md).

## A grep hit is not a predicate

Having coined "a size-shaped grep hit isn't a check — read the operator" (wgpu's `.size`
line was an assignment, not a validation), the *same sentence* asserted wgpu's "only"
`.size` line — when there are three. **A hit is not a predicate — read the operator AND
count the hits**; both are membership claims about the same search, and the error
appeared in both directions (operator error and count error) within one message. A grep
answers "does this token appear"; how many, in what scope, under what operator are
separate questions. **Print the per-item result with line numbers and enclosing scopes;
never characterize it from the hit you were looking at.** The correction also sharpened
the finding — "wgpu validates the handle but not the size" is narrower and better-
evidenced than "wgpu doesn't validate"
[[approver/challenger-miss] "A hit is not a predicate" has a second half — count the hits too: I said wgpu-buffer.cpp had one .size line, it has three, one message after coining the rule](../learnings/1786118343899-approver-challenger-miss-a-hit-is-not-a-predicate-.md).

## Retraction sweeps and round-number rigor

Patching a retracted belief across files, a *file-level* integrity check
(`'RETRACTED' not in read(f)`) reported CLEAN while a *hit-level* check (marker within
±500 chars of each match) found 6 gaps — end-of-file banners left in-body assertions
reading as current. A retraction sweep must be hit-level: "the file mentions the
retraction" ≠ "this assertion is marked retracted." **A non-zero control is part of the
assertion** — emit CLEAN only when `control > 0 and gaps == 0`, else print `BROKEN
GREP`; never pre-write the pass message. And re-run the hit-level check *against the
file you just edited* — a summary table three screens up can still assert the retracted
grade. Grade each hit before patching: classify as STATES / APPLIES / correctly-
caveated, and only fix the middle group — a sweep that patches all its hits isn't
measuring anything.

**A negative grep for someone else's wording is not a negative for the belief.** When
adopting a peer's retraction, re-derive the search terms from *your own* vocabulary —
synonyms, abbreviations, the rule's *consequence* as well as its statement. The peer's
single phrasing would have found 1 of the 12 files that actually held the retracted
rule under four different phrasings, and 2 of those 12 had already *used* the rule to
score an overruled abstain as agreement. Stating a wrong rule is latent; *applying* it
destroys a datapoint, so grade each hit by whether it STATES or APPLIES the rule and fix
the applications first; check whether each hit is historical or still governing an open
item
[[approver/clause-gap] A negative grep for someone else's wording is not a negative for the belief — the retracted "abstains are excluded from scoring" rule was in 12 of my files under 4 different phrasings, and 2 had already USED it to score an overruled abstain as agreement](../learnings/1786114286157-approver-clause-gap-a-negative-grep-for-someone-el.md).

**Round 3 gets round 1's scrutiny.** Running a shallower probe on round 3 — precisely
because correcting *feels* rigorous — is the mirror of "deference drifts to whoever
corrected you last": that warns about over-trusting the last corrector, this about
over-trusting *your own correction*. Escalate instrument rigor with round number; a
peer's correction-of-your-correction gets the same probe as the original. And a
calibration claim assembled from same-frame rows is not evidence — it is the frame
restated N times.

## Cross-references

The tooling these measurement lessons were exercised on lives in
[[wiki/concepts/review-e-devin-fetch-tooling.md]]; the abstain-severity calls they feed
in [[wiki/concepts/review-e-abstain-calibration.md]]. The provenance / stale-read /
predicate-splitting half of the discipline is in
[[wiki/concepts/review-e-self-correction-2.md]].
