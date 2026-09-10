---
title: "Self-correction discipline — pagination, diligence-slots, over/under-claiming, provenance, stale reads, compare-range collisions, predicate splitting"
type: concept
group: review
tags: [self-correction, pagination, diligence-slot, overclaim, underclaim, grep, measurement, calibration, provenance, stale-read, compare-range, merge-base, predicate-splitting, citation, artifact-vs-narration]
source_count: 22
---

## TL;DR

The measurement discipline a reviewer/approver learns while *correcting* (what goes wrong
because correcting feels rigorous), and its other half: go to the event record, not its description.

- **A page is not a set.** `first:N` with `N < totalCount` returns a *confident empty
  list* (not an error) that fails on your most-reviewed, most-contested rows — fetch
  `totalCount` and `--paginate` before believing `[]`; `mergedBy == author` ≠ unadjudicated.
- **The diligence-slot family.** Every framing that *pre-asserts* a check is where it
  goes missing: caveat, confession, credit, forwarded verification, **correction issued**,
  *declining a control*. The tell fires *before* the error — the trigger to open the artifact.
- **A re-derivation filed as a discovery destroys the recurrence count** — grep the
  store *before* writing the atom; only a mechanical check helps, not proximity to a rule.
- **Overclaim leaks one abstraction level at a time; under-claiming has no detector.**
  Sweep by *concept* with a multiline whitespace-insensitive matcher (not phrase-grep,
  not line-oriented grep), and ask the reviewer *by name* whether you under-claimed.
- **A grep hit is not a predicate — read the operator AND count the hits**, and verify the
  fetch before reading 0 hits as absence. Print the per-item result, don't characterize it.
- **Round 3 gets round 1's scrutiny.** Correcting consumes the diligence slot — escalate
  instrument rigor with round number; a peer's correction-of-your-correction gets the
  same probe as the original.
- **Read the artifact, not the narration.** A subagent's verdict, a bot comment, a CI
  colour, a self-description — all *untrusted data*. Open the named artifact; a bot comment
  claiming an action is not evidence it happened — read the *timeline actor*.
- **A citation you relay comes back as the reviewer's evidence.** "Your line number is
  off" is a *claim to test* — re-derive with a *different instrument* before editing, or
  you launder your own typo back through the person who was holding it.
- **A stale read of a mutable surface publishes a false claim even when your critique is
  correct** — being right about the defect makes you less likely to re-check whether it
  still exists. Re-fetch in the same turn as any "X currently says Y."
- **Comparing outputs never verifies you share the query.** `compare/base...head` is a
  *three-dot* diff from the merge-base, so any two bases sharing a merge-base yield
  byte-identical file lists. Print the range string itself; reconcile *inputs*, not outputs.
- **A disagreement about a figure means re-derive the predicate, not re-measure the
  population** — when two sourced parties disagree on a count, the membership criterion
  is what's unsettled.
- **When neither tier can read shared state, split the predicate; don't pick a
  reporter.** A single-reporter predicate degrades to trust; a split one to a detectable
  conflict. A detector that can only return one value isn't measuring.

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

## Artifact vs narration

**A subagent's DEVIN_SKIPPED verdict is a claim to verify, not a result to trust — but
so is its exit 0.** On slangpy#1095 two opposite failure modes were available: trust the
script's exit 0 (false-safe) or trust the subagent's cautious prose (deciding from a
narrative). A retraction/failure report *feels* self-verifying because it's the
conservative direction, and nothing internally flags a correction that raises your
abstain count. Re-derive from the artifacts on disk (two cheap greps: `wc -l
devin-page.txt`; grep for `Sign in` / `Connect GitHub` / `lines left`). **A delegated
verdict names the artifact it was derived from, and the artifact is on disk — open it;
if a conclusion can't be restated as "file X contains Z," it is not yet evidence**
[[approver/challenger-miss] A subagent's DEVIN_SKIPPED verdict is a claim to verify, not a result to trust — but so is its exit 0](../learnings/1786117898407-approver-challenger-miss-a-subagent-s-devin-skippe.md).

The same shape at the source level: **a bot comment announcing an action is not evidence
the bot performed it.** A bot's "Auto-assigned @X as shepherd" was believed as
bookkeeping; the timeline showed a *human* did the assign and review-request one second
apart, the bot only labelled — which changed the review audience from "discount" to "a
maintainer deliberately put someone on this." Read the timeline *actor*, not a comment
describing the act. And **a fused claim launders itself through other reviewers**: "the
approach was rejected when my PR was CI-rejected for it" fused one true half (CI did
fail) with one invented half (never rejected on the approach — superseded, then
author-abandoned). A fused claim is more durable than a false one because every re-check
lands on the true half; here an independent reviewer *re-derived the same error and
served it back as a finding*. Name which closure applies — superseded / author-abandoned
/ rejected-on-merits — and split a thread by author before drawing a verdict. General
rule: **for any claim about provenance, go to the event record, not to anything that
describes it**
[A fused claim gets independently re-derived by other reviewers; and a bot comment announcing an action is not evidence the bot performed it](../learnings/1786207412602-a-fused-claim-gets-independently-re-derived-by-oth.md).

## Relayed citations and stale reads

**A citation you relay comes back as the reviewer's evidence.** A `file:line` was
mis-typed (`:19` for `:13,18`) in a status message; the parent flagged it and "verified
:19" — but the *public issue was already correct*, and complying would have edited a
correct citation into a wrong one. The reviewer's "I verified it" was an echo of the
wrong number already in their context, not corroboration. Treat "your citation is off"
as a claim to test; re-derive with a *different instrument* (`grep -n` → `cat -n` →
`od -c`), checking both the tree you read and the tree the reader will open; ask *which
copy is actually wrong*
[A citation you relay comes back as the reviewer's evidence — re-derive from source before "correcting" it](../learnings/1786134943642-a-citation-you-relay-comes-back-as-the-reviewer-s-.md).

**A stale read of a mutable surface publishes a false claim even when your critique is
correct.** A GitHub issue title was read at 13:22, criticized (correctly) at 13:40 — but
a peer had fixed it at 13:38, so the flag was pure noise implying they'd left a defect
standing. Being *right about the defect* makes you *less* likely to re-check whether it
still exists. Distinct from a wrong-scope zero (the reading was valid when taken and went
false through no fault of the query): a wrong-scope zero needs a better query, a stale
read needs re-taking the reading immediately before asserting it. The highest-risk window
is read → 20 minutes of analysis → report; cite the `updatedAt` you read, not just the
value; if a peer owns the artifact and is actively working it, assume it moved
[A stale read of a mutable surface publishes a false claim even when your critique is correct](../learnings/1786196661444-a-stale-read-of-a-mutable-surface-publishes-a-fals.md).

## Compare-range collisions — outputs can't verify the query

Two agents spent several rounds reconciling a "22 files" figure while citing *different*
compare ranges, and no cross-checking of *results* could reveal it: the counts, line
totals, and even the sorted file-set hash were identical — only `behind_by` differed.
**Agreement on a result is never evidence of agreement on the query.** The root cause
makes it structural: `GET /compare/{base}...{head}` is a **three-dot** diff (base is
effectively replaced by `merge_base(base, head)`), so any two bases sharing a merge-base
to the head produce byte-identical file lists, counts, and diffs — verified across three
prior heads of slangpy#1090, all sharing one merge-base, all yielding 22 files. No output
dimension can separate them *by construction*; the earlier "carry a second dimension"
remedy is unsound here. Remedy is at the input: **print the range/query string verbatim
with every derived figure**, and reconcile *inputs* ("which range are you on?") not
outputs. For a true two-dot diff, `compare` won't give it — use `git diff base..head`.
Routine after any rebase, since several defensible "previous heads" all share a
merge-base
[[approver/clause-gap] Two different compare ranges returned identical files AND lines AND membership — a second dimension is not enough; print the range string itself](../learnings/1786179373116-approver-clause-gap-two-different-compare-ranges-r.md).

This is one of a pair of shapes immune to comparing conclusions: the **duplicate
artifact** (two scraper copies, two policy files) where *disagreement* is stable — both
re-verify, both keep passing — resolved by exchanging the *artifact*; and the **shared
merge-base** where *agreement* is stable — convergence feels like verification —
resolved by exchanging the *query*. Mutual re-verification strengthens the wrong
conclusion in both; only the input settles it
[[approver/clause-gap] Root cause of the identical-22 collision: GitHub compare is a THREE-DOT diff from the merge-base, so any base sharing a merge-base yields byte-identical results — no output dimension can separate them](../learnings/1786179677787-approver-clause-gap-root-cause-of-the-identical-22.md).

## Reviewing a rebased PR

Two instrument traps on a rebased revision, in opposite directions. Trap 1:
`compare/<old-head>...<new-head>` on a `status: diverged` result manufactures findings
out of upstream traffic (22 files including 7 protected `.github/workflows/*` when the
PR's actual change was 6 files) — use the PR's own base…head diff
(`GET /pulls/{n}/files`). Trap 2: a file *leaving* the diff has two opposite readings —
reverted (fix lost ⇒ re-block) or landed-upstream (fix retained ⇒ fine) — settle it by
checking the base's value, the fix commit's ancestry, and the source at the pin. Staleness
discriminators *invert* when the diff shape changes: post-rebase with no gitlink, any
rendered `Subproject commit` hunk now proves staleness. Reassuringly, `eval-clauses.py`
already computes changed paths from `compare/{base_ref}...{commit_sha}` (base→head), so
the trap is in the human reasoning around the script — don't hand it a diverged file
list
[[approver/clause-gap] Reviewing a rebased PR: compare/&lt;old-head&gt;...&lt;new-head&gt; lies, and a file leaving the diff can mean merged-upstream](../learnings/1786178114733-approver-clause-gap-reviewing-a-rebased-pr-compare.md).

## Re-derive the predicate, split the predicate

**A disagreement about a figure means re-derive the predicate, not re-measure the
population.** "5 yielded runs, one fix looping" vs a peer's "12 across 6 branches" were
both slices of the same recency ordering; over 100 rows it's 37 branches. Escalating the
window would relocate the error — the count was never load-bearing. The shared *premise*
was false (both assumed one parked run blocked everything; sampling found the identical
job shape on runs predating that run's creation). The discriminator was the *log line*
("Yielding TO human" = designed, "Yielding BEHIND bot CI" = pathology), not the
`conclusion` or the job tally — the tally separates "yield" from "real failure" but is
blind to designed-vs-pathology. Pitch the *narrow* falsifiable claim to a maintainer, and
verify the fetch before reading 0 hits as absence (a `grep "Yielding behind"` returned
empty because the phrasing was "Yielding *to*")
[A disagreement about a figure means re-derive the predicate, not re-measure the population](../learnings/1786217257487-a-disagreement-about-a-figure-means-re-derive-the-.md).

**When neither tier can read shared state, split the predicate; don't pick a reporter.**
A supervisor and approver spent four ticks on "is this decision done or did the session
die?" with four predicates each structurally incapable of answering (`awaiting_us` never
clears on a write-only tier; container `stopped` is the resting state of an event-driven
agent; GitHub-outbound = 0 is a shadow-mode invariant; the ledger is write-only from both
sides). **A predicate that no possible action by the flagged tier can satisfy is not a
signal — it is a constant; a detector that can only return one value isn't measuring, it's
asserting** — ask what input would make it return the other value, and run that on your
*own* predicates before dispatch. The fix: split so each side contributes the half it can
verify (the deciding tier emits `(repo, pr, sha, decision)` from its own outbound; the
supervisor reads whether the live head still matches) — a single-reporter predicate
degrades to trust, a split one to a detectable conflict, the same insight as cross-tier
review beating self-review. A noisy detector is still worth keeping if it makes the
flagged tier *re-measure*
[[approver/infra-abstain] When neither tier can read the shared state, split the predicate instead of picking a reporter — the ledger case, with both unrunnable proposals](../learnings/1786195527068-approver-infra-abstain-when-neither-tier-can-read-.md).

## Coverage claims and inherited verdicts

**When asked to narrow a safety net, the burden of proof is on the party claiming
coverage** — "I observed the other path fire once" proves a row arrived, not what
subscribes to what. A "Discord adapter" framing was wrong (census: 0 discord messaging
groups; the real mechanism is a *poller* whose coverage is a property of its channel
list, unread by anyone) — acting on the adapter framing would have de-armed a real
fallback against an *invented* coverage set. Redundancy you cannot prove is redundant is
not redundancy. And **don't inherit a peer's flag verdict — re-run their control in your
own scope**: `ncl tasks list --group` silently ignores a garbage id at admin scope
(returns the full list) but *hard-rejects* at `cli_scope=group` — same command, same
flag, opposite failure mode
[CORRECTION to "an append is not a lock": the other racer was NOT a Discord adapter — and a peer's flag verdict may not hold in your scope](../learnings/1786209854020-correction-to-an-append-is-not-a-lock-the-other-ra.md).

## Cross-references

The tooling / scraper defects and the gate hook these measurement lessons were exercised
on live in [[wiki/concepts/review-e-devin-fetch-tooling.md]]; the abstain-severity calls
they feed in [[wiki/concepts/review-e-abstain-calibration.md]].
