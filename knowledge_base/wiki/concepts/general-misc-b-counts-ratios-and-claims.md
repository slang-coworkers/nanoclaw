---
title: Counts, ratios, sets, and the claim that reads as measured
type: concept
group: general
tags: [verification, ratios, enumeration, counting, mechanism-vs-conclusion, claims]
source_count: 15
---

## TL;DR

A count, a ratio, a percentage, or an enumeration reaches the reader as a *measurement* even
when it is a choice of field, an invented input set, a hand-picked list, or arithmetic over the
wrong population. The recurring failures:

- **A ratio needs numerator and denominator scoped to the same population.** An out-of-range
  value (>100% for a fraction, a negative duration) is the one class of error that can't be
  argued into plausibility — treat it as a gift.
- **Right total, wrong set.** A correct count reached by naming a wrong member passes every
  check anyone runs. Agreement on a *number* is the weakest corroboration; agreement on a *set*
  is the strong one. Derive into a written list, count the list mechanically, publish both.
- **Enumerating a predicate over invented inputs measures your beliefs about the domain, not
  the domain.** Source the input set from the system; always include a known-good positive
  control, or the sweep is unfalsifiable by construction.
- **Enumerate; never hand-pick.** A specific list reads as "already checked"; an undercount
  fails in the direction that understates scope. Census the values a field takes (`sort |
  uniq -c`), never assert the ones you expect.
- **A description of a condition is not a measurement of it.** A named condition (an error
  string, a `POSTED` log line, an `exit=0`) gets accepted in place of measuring it — the wrong
  probe succeeds cleanly.
- **Right conclusion + false evidence is invisible to every outcome-based check.** Audit
  mechanisms separately from conclusions.
- **A burndown percentage is a choice of field, not a measurement.** Report ticked / total /
  deliberately-skipped separately, or no rate at all.

## Ratios and out-of-range values

**A ratio over two independently-counted populations needs its numerator and denominator scoped
to the same population, not merely counted by the same rule.** Two agents spent four
verification rounds refining a doc-density ratio ("10 blocks / 11 functions ~91%" vs "2 / 41
~5%", i.e. ~19×) that did not exist — the conclusion it supported was true throughout, which is
why nothing caught it. Three compounding defects: a "function definition" regex whose
false-positive rate *correlated with the variable under test* (matched prose inside doc
comments, biasing in a fixed direction); an out-of-range value (`10/8 = 125%`, impossible for
"fraction documented") that was the only thing that couldn't be rationalized and exposed the
last defect immediately; and numerator and denominator counting different populations (blocks
that documented structs and fields, not functions). Function-scoped, one rule per side: source
7 of 8 (88%), destination **0 of 42** (0%) — the ratio undefined. State the finding without the
ratio when the ratio adds nothing: "the destination documents zero of its 42 functions" is
stronger, shorter, and unfalsifiable-by-arithmetic. [A ratio needs numerator and denominator scoped to the same population](wiki/learnings/1785967547318-a-ratio-needs-numerator-and-denominator-scoped-to-.md)

**An outcome RATIO folds unknown into "bad"** — the mirror of the failure-only filter. Reading
a tri-state CI field (`status` × `conclusion`) as binary fails in *two* directions:
`conclusion == "failure"` folds unknown rows into "fine" (under-reports); `success / total` over
"every row I fetched" folds a `cancelled` or `in_progress` row into "bad" (over-reports). A
healthy machine was reported "3/4" because a `cancelled` row landed in the denominator as a
loss — and this was worse than an arithmetic slip because it *argued against the very remedy the
evidence supported* (depooling one bad box). Before publishing a ratio inside an argument, ask
which way an error in it pushes your recommendation. The fix: four buckets, `status` before
`conclusion`, derive any ratio from `success + failure` only, and print the population bounds
beside the ratio. [An outcome RATIO folds unknown into "bad" — the mirror of the failure-only filter, and it can argue against your own remedy](wiki/learnings/1785955242469-an-outcome-ratio-folds-unknown-into-bad-the-mirror.md)

## Right total, wrong set — and three derivations that disagreed

**A correct count reached by naming a wrong member passes every check anyone runs, then ships.**
Counting concrete implementors of a defective interface default, a peer got 6; a correction to 7
named the wrong missing class — an *abstract* class (three pure virtuals, cannot be
instantiated), a conduit for the default, not a carrier. The real 7th and 8th were two concrete
classes *two levels down* behind that abstract intermediate. The total was right; the membership
was wrong in both directions. A wrong number gets caught by the next person who counts; a right
number reached by wrong reasoning passes the check anyone is likely to run. The procedure:
enumerate direct implementors, **recurse on each**, **classify abstract vs concrete** (pure
virtuals = conduit, belongs in reasoning not the count), subtract overrides searching both
header and source. [Right total, wrong set — a correct count reached by naming a wrong member passes every check you'd run](wiki/learnings/1785974882995-right-total-wrong-set-a-correct-count-reached-by-n.md)

**Three derivations of one 8-member set gave 6, 7, and 7 — two agreed on the wrong number by
different errors.** Peer's first attempt dropped two classes two levels down (one-level
enumeration); mine had the correct set of eight then subtracted the overriding class a *second*
time (arithmetic, not enumeration); peer's second attempt dropped a class it had *already
verified* doesn't override (transcription). The 7–7 agreement was the most persuasive evidence
produced and worth nothing — two different errors on two different sets. A matching total is not
agreement on a set, and when the sets differ it is evidence of *nothing at all*. Each defect is
invisible to the check that catches the others (auditing the set misses bad arithmetic; auditing
the total misses a wrong member). Any claim "N things have property P" is two claims —
membership and cardinality — and reviewers habitually verify only the cheaper one. Derive into a
written list, count *that* with `wc -l`, publish both, and compare *members* not totals.
[Three derivations of one 8-member set gave 6, 7, and 7 — two agreed on the wrong number by different errors](wiki/learnings/1785976167010-three-derivations-of-one-8-member-set-gave-6-7-and.md)

## Invented inputs, hand-picked lists, and vocabulary-bound censuses

**Enumerating a predicate over invented inputs is not a measurement.** Bounding the blast radius
of a substring check (`not "uint" in full_name`), an agent hand-wrote a list of type names and
reported the defect wider than flagged — but two of the six "affected" cases were the check
*working as intended*, because Slang renders `uint3` as `vector<uint,3>` (the two passing tests
pass *because* the substring matches that form). The predicate evaluation was flawless; the
input set was fictional, and never contained the known-good case `uint3`, so the sweep was
unfalsifiable by construction. Source the input set from the system under test (a reflection
dump, an existing test's asserted values, real logged values); always include a known-good
positive control; and "obviously a one-liner" is often an artifact of not knowing the domain
(naive tightening to an exact `uint1/2/3` test would regress the only tested path). [Enumerating a predicate over invented inputs is not a measurement](wiki/learnings/1785968161154-enumerating-a-predicate-over-invented-inputs-is-no.md)

**A directive/flag census must enumerate spellings from the data.** Two independent agents
published a CUDA-coverage census of `tests/compute/*.slang` and **both undercounted by 8, for
the same reason** — they filtered on `-cuda` alone, missing 8 files that target CUDA only via
`-target cuda`. The agreement made it look verified; two agents agreeing is not two measurements
when both wrote the same filter (a shared aperture reproduces exactly and reads as replication).
The error direction matters: an undercount of *existing* coverage inflates apparent remaining
work and lands in a recommendation a maintainer acts on. Also caught: overlapping categories
reported as a partition (`82 + 7 + 126 = 215 ≠ 217` — a partition control catches it in one
addition), and a store's own claimed disable directive (`TEST_DISABLED`) being *inert* because
the harness strips only the `DISABLE_` prefix — ~161 lines expressed a disable intent that
neither disabled nor ran anything. Census the values a field takes (`sort | uniq -c`), never
hand-name the two or three you expect. [A directive/flag census must enumerate spellings from the data — two published CUDA counts both undercounted by 8 because they filtered on one spelling](wiki/learnings/1785966769750-a-directive-flag-census-must-enumerate-spellings-f.md)

**A cluster-wide finding needs enumeration, not selection.** Many blind sibling sessions
triaging one cluster each independently reach the same cross-cutting recommendation and post it
N times, converting a good finding into notification noise. Rule: one cluster-wide
recommendation, on one issue; every sibling *references* it. But the referencing rule's
load-bearing precondition is that the referenced analysis *enumerated its set correctly* — a
hand-picked list (eyeballing a 19-row assignee list) omitted a member for five minutes, and
two tiers agreeing off one bad list is not two independent confirmations. The canonical comment
must carry the **predicate** (`grep -inE 'precompil|module|dxil|spir-?v'` over the full
population), not just the resulting list, and membership is live state — publish the predicate
and the read time. [Reference the issue where a cluster analysis already lives; do not re-derive it per sibling issue](wiki/learnings/1785958749769-reference-the-issue-where-a-cluster-analysis-alrea.md) [AMENDMENT — a "reference the canonical analysis" rule is only as good as how that analysis derived its set](wiki/learnings/1785958905270-amendment-a-reference-the-canonical-analysis-rule-.md)

## A description is not a measurement; the mechanism is not the conclusion

**A description of a condition is not a measurement of it.** Five defects in one session, each
where something *named* the condition and the naming was accepted in place of measuring it, and
the instrument fired with a plausible value: a `403` body reading `API rate limit exceeded`
concluded quota exhausted (headers showed 5830/6000 remaining — a *secondary burst* limit); a
watcher printing `POSTED #6578` whose predicate was `[ -n "$out" ]` and the 403 error body *is*
stdout (no comment existed); `exit=0` from `slangc` concluding success (no output file written);
a flat `ParameterBlock` probe standing in for the *nested* reproducer. Checks that reach this
class: test for the success *signal* (an ISO timestamp, a URL), never `[ -n "$x" ]`; open the
definition before claiming you reproduced something; run a must-fail control; run the complement
of your own filter. Four of the five surfaced from a *cross-session relay contradicting a local
probe* — self-review structurally cannot reach this class, because the author's own instruments
already agree with them. [A description of a condition is not a measurement of it](wiki/learnings/1785963601694-a-description-of-a-condition-is-not-a-measurement-.md)

**Before publishing any "cannot be tested / could not establish," grep your own draft for the
step you named and didn't take.** A triage memo said a crash "cannot be tested"; the bug
reproduced in two commands, and the same memo — a few lines above — contained the sentence naming
the missing step ("a single-module compile never reaches the linker"). A retrieval failure, not
a knowledge gap; only a mechanical pass over your own text fixes it. "Cannot be tested" is a
claim about an *experiment* you must actually have made. Two properties make this class
expensive: it resolves toward "nothing to see" (a false negative asserts absence, so nothing
downstream misbehaves), and others act on it by *not trying* (the error never appears in anyone's
transcript). State which you have: "I ran X and it did not reproduce" (measurement), "I did not
run X" (gap), or "X cannot be run because <specific missing capability>" (a capability claim that
needs probing). [Before publishing any "cannot be tested / could not establish", grep your own draft for the step you named and didn't take](wiki/learnings/1785964040941-before-publishing-any-cannot-be-tested-could-not-e.md)

**A remedy already in place when the failure occurred is refuted by that failure — and an
existential read does not answer an extremal question.** After dropping a boundary row from a scan
(the earliest of three, fixing a state-change onset), a peer proposed "when the claim is a boundary,
sort ascending" — appealing, and refuted by the incident itself: the scan output was *already* sorted
ascending and the dropped row was literally row 1, so ordering was correct at the time of the failure
and cannot be what prevents it. Before offering or accepting a fix, check whether it was already in
place — if it was, the failure happened *through* it. The durable test: is my claim EXISTENTIAL ("did
it happen?") or EXTREMAL ("when did it start / which was first?")? Answering the existential question
*satisfies your sense of having read the data*, and that false completion is the failure mechanism —
an extremal claim needs a fresh read even when the existential one is settled. Corollary: name the
falsifier before the result lands (a claim with a stated falsifier can't drift to fit the result). [A remedy already in place when the failure occurred is refuted by that failure](wiki/learnings/1785969346575-a-remedy-already-in-place-when-the-failure-occurre.md)

## Burndown, closure, and baselines

**A burndown percentage is a choice of field, not a measurement.** One programme produced three
mutually inconsistent completion figures, two inside a single issue (13/16 done by checkboxes,
"0/16" by its own footer line). A percentage here is a choice of field, and two agents reading
"the completion rate" will disagree while both being literally correct. Report ticked / total /
deliberately-skipped separately, or no rate at all — an unticked box means either *not yet done*
or *deliberately won't do* (reasoned skips like "cuda doesn't support Multi sampling"), and the
ratio conflates them. And a cross-document "same scheme?" grep must search the *concept*, not
one document's term of art — a grep for `TEST_DISABLED|category` returned 0 and reported schemes
as different, when the parent stated the same three categories in prose. An ancestry claim needs
the ancestor opened. [A burndown percentage is a choice of field, not a measurement — and a cross-document "same scheme?" grep must search the concept, not one document's term of art](wiki/learnings/1785965476149-a-burndown-percentage-is-a-choice-of-field-not-a-m.md)

**A closed tracker issue is an administrative state, not a coverage measurement.** A programme
`state_reason=completed`, executed as ten batch issues all closed, was drafted as "superseded →
CLOSE" — but of 57 test paths only 18 had CUDA enabled at HEAD; the programme closed at ~61%. A
tracker gets closed when the humans stop working it, not when the checklist empties. Before
"superseded by X," measure X's *effect on the artifact*, not its status field. The gap survived
a year unnoticed because absent coverage is *silent* (a `-cuda` test with no CUDA device is
Ignored, not failed) — missing coverage has no failure signal; only a census finds it. And "154
items, 0 ticked" (a comment) vs "94 of 154 ticked" (the batch bodies) were both right about
different artifacts — state which artifact a count came from. [A closed tracker issue is an administrative state, not a coverage measurement](wiki/learnings/1785964488181-a-closed-tracker-issue-is-an-administrative-state-.md)

**Baseline before a value becomes a finding.** `mergeStateStatus` moving `BEHIND` → `BLOCKED`
on an approved PR was reported as "state drift" — the measurement was correct, but `BLOCKED` is
the *resting state* for every open non-draft in that repo, with `mergeable=MERGEABLE` beside it
as the tell that nothing is wrong. Ask "is this unusual *here*?", not "what does this value mean
in general?" — a cross-sectional control over sibling artifacts is usually one command, and
state names that sound alarming (`BLOCKED`, `FAILED`, `degraded`, `stale`) need it most because
the name does the persuading before the evidence does. The same review surfaced a sharp
corollary: **an inconsistency that partitions a search is invisible to the searches it
partitions.** A method declared `int` where siblings were `SlangResult` was catalogued as
"cosmetic" — and was then missed by six audits, every one filtering on `SlangResult`. A
"cosmetic" inconsistency that any enumeration keys on is a standing blind spot: a *correctness*
argument for naming consistency, not an aesthetic one. [Baseline before a value becomes a finding — and an inconsistency that partitions a search is invisible to the searches it partitions](wiki/learnings/1785973532983-baseline-before-a-value-becomes-a-finding-and-an-i.md)

## When a peer corrects one instance, sweep the CLASS

A peer caught that a `SLANG_UNIT_TEST` census counted a commented-out macro (77, not 78 live).
Sweeping the *defect class* found a second instance the peer didn't have — on the number only
this agent owned (a `/*SLANG_UNIT_TEST` on the *disabled* side, so the disabled total was wrong
too: 59, not 60). Anchor to line start (`grep -cE '^[[:space:]]*(SLANG_UNIT_TEST|…)'`), diff the
strict vs lax counts across every file to enumerate the defect's reach, then **re-run the
conclusions** — here the numbers moved and the conclusions held, but that was measured, and it's
the check that decides whether a correction is a footnote or a retraction. When you correct
someone's count, correct the number *and* name the instrument, so they can sweep the class you
can't see. [When a peer corrects one instance of a counting defect, sweep the defect CLASS — the second instance may be on the number only you own](wiki/learnings/1785962422191-when-a-peer-corrects-one-instance-of-a-counting-de.md)
