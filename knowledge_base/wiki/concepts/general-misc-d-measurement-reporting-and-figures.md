---
title: "Publishing Figures: Provenance, Units, Windows, and Self-Checking Counts"
type: concept
group: general
tags: [measurement, reporting, figures, counting, tri-state, provenance, thresholds, ranking]
source_count: 13
---

## TL;DR

How a *number* goes wrong on the way to a report, distinct from how an *instrument* goes
wrong (that lives on the false-negatives page). The recurring lessons:

- **A published figure needs FOUR things — number, unit, subject, provenance — and each
  missing one fails silently** except the first.
- **A count next to its own list is a self-checking pair — count the list.** And **an
  unused figure is an unchecked figure** that still ships into the audit record as
  measured.
- **A figure you cannot re-derive on demand is worse than no figure**, because it reads as
  evidence and someone acts on it.
- **A hedge that preserves literal truth while destroying usefulness** (`517+`, `≥36`,
  "aged out of the window") is worse than a wrong number — a wrong number invites
  correction, a hedge deflects it. The real defect is the *implied present tense*: no
  *unwindowed* counts.
- **Prose is where tri-state bucketing leaks** — "14 of 15 red" is a two-bucket sentence
  describing three-bucket data.
- **A window is a property of your query, not of the thing** — a ratio or rank from a
  windowed listing describes the window; a round-numbered N is your page size.
- **A threshold that fires on 100% of samples is a constant, not an alarm** — prove it
  *varies*.
- **Rank defects by rows corrupted, not by how satisfying the fix is** — reasoning defects
  outscore instrument defects and attract less attention.

## The four properties of a published figure

Only the first announces itself when missing:

| property | missing ⇒ | how it fails |
|---|---|---|
| **number** | no claim | announces itself |
| **unit** | "24,898 against a 24,400 bound" | silent — both readings internally consistent |
| **subject** | "`39d961e7…` vs `28351aaa…`" | silent — reader supplies a subject by inference |
| **provenance** | a line number from `sed -n 'A,Bp'` | silent — a guess dressed as a measurement |

The **unit** error cost three sessions: an index was measured in bytes (`wc -c`) against a
char-denominated bound, inventing ~900 units of phantom pressure, and the wrong unit had
propagated into 8 files including executable `head -c <bound>` truncation recipes. *It
survived because the error was conservative* — it cost effort, never correctness, so
nothing ever looked wrong. The **subject** error round-trips: two correctly-computed md5
hashes published with *no file named*, so the reader supplied a subject by inference, named
the wrong file, and attributed the misnaming back to the reporter. **Two files agreeing
because one copied the other is NOT corroboration; two tiers agreeing because each opened a
DIFFERENT artifact is** — complementary blindness, which only pays out when both sides
exchange *artifacts* rather than conclusions. [A published figure needs FOUR things — number, unit, subject, provenance — and each missing one fails silently](wiki/learnings/1786085427422-a-published-figure-needs-four-things-number-unit-s.md)

## Count the list next to the count

"10 of the 11 new atoms don't exist" followed by an enumeration of exactly 10 items is
refutable *from the text alone* — zero retrieval, zero API calls. **A count next to a list
is a self-checking pair; count the list.** The root cause of why it survived: **an unused
figure is an unchecked figure** — the verdict rested on the *position* of the insertion,
not its cardinality, so nothing downstream ever contradicted "11" and it still propagated
into a durable audit artifact a human reads as measured. Fixes, in order: re-record the
ledger row in place (a stale audit artifact whose headline fields still look right is the
worst surface to leave wrong); sweep every surface for the *superseded* number, not the fix;
and state explicitly what the correction does and does not change. [A count next to its own list is a self-checking pair — and an unused figure is an unchecked figure that still ships into the audit record](wiki/learnings/1786115712715-a-count-next-to-its-own-list-is-a-self-checking-pa.md)

**A figure you cannot re-derive on demand is worse than no figure.** "130/130 passing" from
a combined `slang-test` run that swept in unrelated tests was true of *something* but not
the claim it was attached to and couldn't be reproduced as stated; replaced with the scoped
9-files/10-of-10. Before publishing, ask: *can I re-derive exactly this number, on demand,
from a command whose scope matches the claim?* Two named detectors — **scope mismatch**
(does the command's scope match the sentence?) and **diff semantics** (for "what does master
have that I don't", never a two-dot diff — your own additions appear as "their" changes; use
the merge-base three-dot). And the strongest proof of deadness is a *reproducible* one:
deleting two allegedly-unreachable branches left `.expected` baselines and output
byte-identical. [A figure you cannot re-derive on demand is worse than no figure](wiki/learnings/1786128642445-a-figure-you-cannot-re-derive-on-demand-is-worse-t.md)

## Hedges, windows, and the implied present tense

**A hedge that preserves literal truth while destroying usefulness is worse than a wrong
number.** A session-start pointer read "517+ files" (true, ~2× low, and understated in the
direction a reader acts on — a small store gets skimmed). The `+` made it *unfalsifiable
while destroying its usefulness*: a reader who sees a hedge reads rigor and stops checking.
The narrowing that works: **no *unwindowed* counts** — a live figure with an implied
present tense ("34 memory files", "517+ files") rots and must be replaced with the command
that derives it, but a *dated historical measurement over a closed interval* ("said 517+
from 08-05 until 08-07, when the real was 1035") is safe because it doesn't purport to
describe now. Mirror cases: a pointer asserting a doubled magnitude, and a loaded index
asserting "Nothing stored yet" for 23 days — *an unmaintained index and a genuinely-empty
one are indistinguishable*, and a file nobody reads cannot be validated by nobody
complaining. [A hedge that preserves literal truth while destroying usefulness is worse than a wrong number — and "no counts in pointers" is really "no unwindowed counts"](wiki/learnings/1786123535248-a-hedge-that-preserves-literal-truth-while-destroy.md)

**A window is a property of your query, not of the thing.** "Red 14 of the last 15
nightlies" is a two-bucket ("red/green") sentence describing three-bucket data — the
cancelled 15th night *tested nothing* (untested, never green), so the truth is 15 of 15
non-green. **Prose is the leak site** because English has no natural word for "ran but
tested nothing," and "not red" always reads as "fine." Then "15" was itself the `per_page=15`
page size quoted as a population — re-derived over the full retained set (`got=40 >=
total_count=40`), it was 40/40 non-green. **A round-numbered window is a page, not a
population** — if N is 10/15/20/30/100, suspect it's your page size. And **40 is a retention
floor, not streak age** — quote as `40/40 non-green in the retained window`, never bare. [Prose is where tri-state bucketing leaks: "14 of 15 red" is a two-bucket sentence describing three-bucket data](wiki/learnings/1786177918559-prose-is-where-tri-state-bucketing-leaks-14-of-15-.md)

## Thresholds and rankings that carry zero bits

**A threshold that fires on 100% of samples is a constant, not an alarm.** The CI-health
runbook's "busy == total ⇒ critical" fired on 37 of 37 frames, because the `*(GCP)` pools
are ephemeral/autoscaled — `busy == total` is their *resting* state and `total == 0` is what
idle looks like. Only the fixed-size static pool ever shows genuine slack. The discriminating
replacement (`queued > 0 AND running == 0`) fired on 19%; better still, alarm on queue *age*
(capacity = runners × job duration). **Before trusting any threshold, compute its firing
rate over a window containing known-good samples** — a predicate that fires on every frame or
never carries zero bits regardless of how sensible it reads. The tell: you find yourself
overriding the documented threshold with a hand-written excuse every time — *the override is
the data.* [A threshold that fires on 100% of samples is a constant, not an alarm](wiki/learnings/1786120926518-a-threshold-that-fires-on-100-of-samples-is-a-cons.md)

Any tally over a string field needs the **distinct-values query FIRST**. Filtering for the
values you *expect* silently drops rows: an eviction `reason` filter of `"failed_checks"`
only missed `checks_timed_out` (tally 3 → 9); counting `result in (reran, outcome_success,
fired)` double-counted a remediation and its own confirmation (49 → 37). Enumerating the
field revealed 15 distinct values where four were guessed. Watch for values you didn't know
existed (bias down), follow-ups that aren't events (bias up, invisible because the total
still looks plausible), and missing/empty (silently excluded). Both directions produce a
number that's plausibly close and internally self-consistent, so arithmetic review can't
catch it. [Any tally over a string field needs the distinct-values query FIRST — filter-for-what-you-expect silently drops rows](wiki/learnings/1786098468528-any-tally-over-a-string-field-needs-the-distinct-v.md)

Free-text prose must **never be a ranking index**. Five wrong CI-ledger figures all came
from regexes over `reason`/`check` free-text: a `12145` substring and a `3221225477` AV code
each matched *inside negations* (rows recording an *absence*), a bare `runner` token matched
prose *naming a host* (17 → 2, 8.5×), and a `fired` value was assumed a synonym for `reran`
when it belonged to `note` rows. **Only a test name is safe as a bare positive signature;
an issue number and an error code are both cited in rows that report *not* finding them.**
The only real fix is upstream: write a `labels:[]` array from a *closed vocabulary* on every
row and rank exclusively over that. Assertions before emitting any ranking: report the
unmatched share (64% unclassified hid the largest cluster), check multi-label sum vs event
count, and run subset checks. And a rerun ledger records only *decisions*, so it ranks
*cost* never *value* — every "quarantine this test" recommendation is structurally beyond
its evidence. [Negation strikes twice: an AV code inside "0 3221225477" is an absence, not an occurrence — and free-text prose must never be a ranking index](wiki/learnings/1786207062119-negation-strikes-twice-an-av-code-inside-0-3221225.md)

## Rank defects by rows corrupted; audit "unchanged" by set not count

**Rank defects by rows corrupted, not by how satisfying the fix is.** Auditing corrupted
approval rows, a mechanical *instrument* defect (unpaginated fetch, 2 rows corrupted) got
promoted to the headline while a *reasoning* defect (treating `mergedBy == author` as "no
independent human adjudicated", 4 rows corrupted) was filed as a footnote — because an
instrument defect has a crisp patch and a reasoning defect has only a habit to change.
Companion findings: a decision-head→merged-head *compare* answers "what changed on this
branch's tip" not "what this PR changes" (use `pulls/<n>/files`); and **a calibration claim
assembled from same-frame rows is the frame restated N times** — when a claim cites N
supporting rows, check whether those rows were classified by the rule the claim is testing.
[Rank defects by rows corrupted, not by how satisfying the fix is — the reasoning defect beat the instrument defect 4 to 2](wiki/learnings/1786116492181-rank-defects-by-rows-corrupted-not-by-how-satisfyi.md)

**A matching total can hide changed membership — diff the SET, not the count**, before
calling a fix a no-op. `820/866` on three consecutive SHAs (two of them explicit fixes)
would read as "no progress"; extracting and diffing the *failing-shader list* per run (same
md5) proved the no-op rather than assuming it — and the membership diff, not the count,
became the one new fact worth posting. For any "X is unchanged / still broken" claim, name
the *object* whose identity you checked (set members, ids, names), because aggregates are
exactly where magnitude-preserving errors (N fixed, N newly broken) survive every sum check.
[A matching total can hide changed membership — diff the SET, not the count, before calling a fix a no-op](wiki/learnings/1786213450603-a-matching-total-can-hide-changed-membership-diff-.md)

## Scope a capability with a table, not an adjective

When a claim is about *capability*, enumerate capabilities and measure each. Describing a
CI-migration's damage, two careful parties mis-scoped in *opposite* directions ("degrades
your Falcor classification" too broad; "I can still see which step failed" too generous) —
opposite-direction errors from two careful parties is the tell that the *format* was wrong.
A measured table fixed it: job red/green retained, which-test+crash-code gone (the entire
loss), which-step now vacuous (7 steps → 1, so the bit carries zero information), sibling
job untouched (0 diff lines). "Technically retained" can be vacuous — **before crediting a
surviving signal, ask how many distinct values it can now take.** And "0 diff lines" is a
fact where "unaffected" is a claim; an unmeasured number placed next to a measured one
inherits its credibility. [Scope a capability loss with a measured table, not an adjective — two parties mis-scoped in opposite directions](wiki/learnings/1786133178353-scope-a-capability-loss-with-a-measured-table-not-.md)

## The always-loaded surface outranks the correct leaf

**A stale figure in an always-loaded surface outranks a correct one in a leaf.** A composed
`CLAUDE.md` line said a CI retry helper "aging force-runs it ≤~8h"; both halves were false
(the helper is contention-gated, reruns cap at 1, runs expire unrerun past 16h), and the
line told every fixer session to do nothing while its CI silently expired — 16 stranded
chains from one line. *The affected coworker's own memory store already had the correct
mechanism*, written before the chain began, and it cited the wrong number anyway: **at the
moment of use, the loaded-but-wrong figure beat the correct one — not from forgetting, but
from proximity.** When a leaf and an always-loaded surface contradict, the fix belongs in
the loaded surface; a composed spine is read-only from inside the container and recomposed
on every wake, so a shared wrong line is a *fleet-wide* bug no coworker can close and must be
escalated as a host-side fix with exact file/line/current/replacement text. [A stale figure in an always-loaded surface outranks a correct one in a leaf](wiki/learnings/1786107329305-a-stale-figure-in-an-always-loaded-surface-outrank.md)

Companion mechanism-verification note that produced the above: **a doc's automation promise
is a claim to verify, not a fact to inherit.** `retry-yielded-bot-ci.yml` reports
`conclusion:success` on every firing while the yielded runs stay `run_attempt=1` — because
`conclusion:success` on a helper means *the helper ran*, never *your run was rerun*; the
only valid instrument is `run_attempt` on your own run, and `attempt=1` after many firings
*is* the starvation signature. The supervisor skill's own text ("a dedicated retry workflow
reruns yielded runs automatically, so show but never act") propagated an unverified
automation promise into a standing instruction, and 16 chains sat behind it. Read the
helper's *log*, not its conclusion; measure the effect on the *target*, not the runner. [A helper reporting success means the helper ran, not that it did its job](wiki/learnings/1786106456042-a-helper-reporting-success-means-the-helper-ran-no.md)
