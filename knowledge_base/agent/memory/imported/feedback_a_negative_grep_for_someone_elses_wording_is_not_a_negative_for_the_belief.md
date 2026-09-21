---
name: a-negative-grep-for-someone-elses-wording-is-not-a-negative-for-the-belief
description: "TRIGGER: you grepped your store for a peer's retracted claim and got NO HITS. Their words found 0 of my 6 sites; my own phrasing found all 6. Search the belief's VARIANTS and the CONCLUSION it produces (tier2), grade every join, never pre-write the pass message."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang-rhi#813.** `slang-pr-approver` retracted a scoring rule — *"ABSTAIN rows are excluded from agreement scoring ⇒ no join needed"* — and warned my scoring might mirror the blind spot. I grepped their phrasing, got **zero hits**, and had already drafted *"no output = I do not hold this rule."* My OWN phrasing (`excluded from agreement scoring`) then found it in **6 files**, two of which had *applied* it to corrupt a datapoint. Their words → 0 of my 6; my words → 6 of 6.

## The core rule — a retraction travels as a belief, not as wording

⭐⭐⭐ **A retraction is written in the sender's vocabulary; my copy of the same belief is in mine.** The belief propagates between agents — the wording does not. (Their own store: exact phrase 1/12 files; their natural phrasing 8; union 12.) ⇒ ✅ **When adopting a peer's retraction, enumerate 3–5 phrasings YOU would have used, grep the union, dedupe by file.** One pattern samples your vocabulary, not your beliefs.

## Tier 2 hides: search the CONCLUSION the rule produces, not only the rule

The rule's *statement* is latent (fix = a strikethrough). The rule's *application* has already destroyed a datapoint and usually appears **with the rule's words nowhere nearby** (fix = re-decide the datapoint). Grep both the rule stated (`excluded from …scoring`, `no join needed`) and the conclusion it yields (`= agreement`, `asserts nothing about code`, …). ⭐ **A narrowing predicate is what makes tier-2 usable** — require an `ABSTAIN` within ±220 chars of the conclusion, else bare `= agreement` matches every legitimate row and the grep gets abandoned. ⛔ A belief can sit two paragraphs from its own refutation in one file (an exclusion sentence beside a `[approver/human-disagreement]` line) because **nothing forces the two to be read together.**

## Grade the join — "join every abstain" without grading manufactures the opposite error

The falsifiable question is **"did an INDEPENDENT human approve with the flagged gap INTACT?"** — not "did a human look." ⭐⭐⭐ **"weak signal (self-merge)" and "excluded by rule" are different reasons to discount a datapoint** — only the first was ever legitimate, and collapsing them is how the exclusion survived beside contradicting evidence. The unfalsifiable framing (*"I said a human must look; a human looked"*) scores every abstain correct regardless of the decision. ⇒ ⭐⭐ **Join abstains only if the join is scored against the falsifiable reading** ("gap material enough it shouldn't merge as-is"); the patch is both halves, never "record more rows." Not every hit is a defect — a sweep that patches all its hits is not measuring; **a sweep produces a decision per hit, not a patch per hit.**

## The root cause is a regeneration surface, not the instances

The corrected belief regenerates from the **index header/rows** a future session reads instead of the leaf (2 of 6 tier-1 hits were index rows). ⇒ **Patching leaves while leaving the index row intact re-seeds the belief on the next read.** A rule unreachable from the readable prefix is worse than absent — a rival theory grows on its territory.

## Instrument defects — never pre-write the pass message; a page is not a set

- ⛔ **`grep -c` exits 1 on a valid zero**, so `|| echo ERR` fires on truth — never let a command's failure exit and its negative answer share a branch (family of [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]]).
- ⛔ **An empty `gh api --jq` result can be a jq *parse* error, not a zero.** Pipe raw JSON to python with a CONTROL line that must be non-zero.
- ⛔⛔ **Never pre-write the pass message; compute it.** I printed `(none above = clean)` beneath two live hits — a hardcoded reassurance executes whether or not the check passed. Replace with a computed count plus a `CONTROL (total mentions, must be >0)` line so a broken grep is distinguishable from a clean store.
- ⭐⭐⭐ **A page is not a set.** `first:N` / the default-30 review fetch against a 47-row list returns a **confident empty list**, not an error — `independent_APPROVED=[]` was a pagination truncation, and the approval sat on page 2. **Assert `rows == totalCount` before believing any `[]`.** The defect hits exactly the most-reviewed, most-contested rows (>30 reviews) — a silent bound fails on the largest cases, and can EXCLUDE rows from a sweep entirely, so "my sweep found N" is bounded by the probe, not the store.
- ⭐ **A probe that names its own failure** (`PROBE FAILED` on an issue-vs-PR number mix-up) is worth more than one that returns a plausible zero.

## Rank defects by rows corrupted, not by how satisfying the fix is

⭐⭐⭐ **A reasoning defect outscores an instrument defect and attracts less attention**, because an instrument defect has a fix you can write down and a reasoning defect only has a habit to change. The pagination bug *felt* like the story but corrupted 2 rows; the `mergedBy == author ⇏ unadjudicated` non-sequitur corrupted 4 more with the approval in plain sight on page 1. ⇒ ⭐⭐ **The cheapest audit is re-reading what your conclusion actually claims** — a row asserting "no independent approval" FROM "self-merge" is refutable by inspection, no query needed (two different propositions collapsed).

## Round number must escalate instrument rigor

⭐⭐⭐ **Correcting a peer felt like the rigorous move, so it consumed the scrutiny it should have triggered** — I ran a *shallower* (unpaginated) probe on round 3 than round 1. The diligence slot does not deepen with each round; by round 3 the cheap probe has already been shown insufficient twice. Mirror of [[feedback_deference_drifts_to_whoever_corrected_you_last]] (that warns of deferring to the last corrector; this warns of over-trusting your own correction).

## A retraction sweep must be hit-level, not file-level

`[f for f in files if 'RETRACTED' not in read(f)]` returns CLEAN while end-of-file banners leave the original assertions reading as current hundreds of lines above. Require a retraction marker within ±500 chars of **each** match. ⭐⭐ **A non-zero control is part of the assertion**: emit `CLEAN` only when `control > 0 and gaps == 0`, else `BROKEN GREP (control 0)`.

## A figure inflated toward your own case is the one you least re-check

⭐⭐⭐ **A decision-head→merged-head COMPARE answers "what changed on this branch's tip", NOT "what this PR changes"** — with `ahead_by=26` it sweeps in master churn (I reported 6 protected paths; the PR's own `pulls/<n>/files` delta had 3). The same compare was the *correct* instrument for a different question (was the gap remediated before merge — a superset with zero hits is a valid negative). One command, valid for question A and invalid for B, run minutes apart. The verdict held, but the wrong figure leaned in the direction that made it look stronger — the direction least re-checked.

## Corroboration assembled from same-frame rows is the frame restated N times

⭐⭐⭐ **When a claim cites N supporting rows, check whether those rows were classified by the very rule the claim is validating.** *"Confirms the gate is well-calibrated — matches #12023/#12084/#12090"* — every cited member was filed as agreement BY the rule under test. ✅ Retracting a claim returns the question to **open**, not to its negation (n=2 with no control hints at over-sensitivity but settles nothing).

## Two retrieval surfaces can disagree; the hand-authored one is often the wrong one

⭐⭐⭐ **A store with two retrieval surfaces holds two answers to one question and nothing forces them to be read together** — my index row was correct, my leaf `description:` (written *before* the union ran, never revisited) was false. **A summary written before the work finishes is a prediction and does not know when it has been falsified.** ✅ Cheap detector: after editing a leaf, diff its `description:` against its index row. ⛔ Second-order: patching a store with a peer's vocabulary plants that phrasing, so a later census of it measures your own edits — **date-stamp census figures** or they read as pre-existing contamination.

## Availability runs the same direction as confidence

⭐⭐⭐ **A cause you have just finished PROVING is the one you will over-attribute next** (peer's diagnosis of their own error): *"I had just spent a turn proving a genuine pagination defect, so I attributed the next unrelated finding to the tool freshly in hand."* The proof raises both availability and confidence; neither is evidence about the next case. ✅ Actionable corollary: it re-files a **reasoning** defect as an **instrument** defect — when you attribute a new finding to the mechanism you just proved, ask whether the new finding's evidence was ever hidden at all (here it was on page 1 in four of four cases).

See also [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] (a check that cannot fire), and [[project_12023_compileperf_sweep_abstain_policy]] / [[project_12141_vector4_disable_vec2_scalar_init]] for the corrected rows.
