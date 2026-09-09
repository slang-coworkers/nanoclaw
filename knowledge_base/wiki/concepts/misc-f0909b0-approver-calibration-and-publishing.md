---
title: "Approver Calibration, Scoring, and Publishing Findings"
type: concept
group: misc
tags: [approver, calibration, label-leakage, false-safe, read-only-tier, merge-outcome, triage-publishing, park]
source_count: 11
---

## TL;DR

A shadow-mode approver's decisions are scored by joining against the human outcome, so the
join is only as good as the outcome label. These learnings sharpen what a `merged` outcome
actually means, when a decision protected anything, and why a finding nobody can publish (or a
park nobody watches) is operationally identical to no finding.

Core calibration rules:

- **`merged` is an action, not a judgment.** Before scoring a decision/outcome mismatch as
  "the human disagreed," prove a human *saw* the finding: check whether any human utterance
  postdates the finding and whether approval predates it. If neither holds, the label is
  **never adjudicated** — it carries zero signal and must not relax the corresponding gap
  severity.
- **Merge is not retroactive proof a verification gap was closed.** Maintainers routinely
  *accept* a coverage gap (ship on code-reading confidence, defer the signal to a tracking
  issue) rather than *close* it. Check whether the missing signal ever executed, not just
  whether the PR merged.
- **Score outcomes, not process.** A sound *process* (naming an unresolved premise) that
  reaches a wrong *outcome* is still a LOSS; keep "process good" and "outcome wrong" as
  separate ledger facts. Score an abstain against its **falsifiable** reading ("material
  enough not to merge as-is"), and refuse the exculpatory "your verdict was right at decision
  time" — accepting it costs the calibration signal.
- **Measure approver value against merge time — but from the recorded `ts`, not the current
  turn's clock.** A session that spans a merge has three clocks; only the decision `ts` and
  the delivery time measure value. The wall-clock drifts forward (unflatteringly) through
  re-sends and memory writes.
- **A finding held by a read-only tier that cannot publish it is identical to no finding.**
  "Hand off to a write-capable coworker" is load-bearing, not a courtesy — and it inherits a
  deadline from any armed auto-merge.
- **Post the artifact on every triaged issue; a park needs an instrument.** The no-post
  exception is process/meta ONLY (no compiler content). A park whose exit condition is a
  third party's action installs a rule, not a watcher.

## "Merged" does not mean "the human agreed with you"

Two agents independently measured the same slangpy#925 case: a confirmed 🟠 Major regression
(`CIBW_ENVIRONMENT_LINUX` *replaces* rather than extends the global cibuildwheel env, so
`SLANGPY_VERSION_OVERRIDE` never reaches Linux) shipped unfixed via auto-merge. The timeline
proves no human ever weighed it — approval (07-29) *predated* the defect's birth and the
finding (08-05); auto-merge was armed 11 minutes *before* the finding posted; nobody ever
replied. Reading `ABSTAIN → merged` as "maintainers find this class acceptable" would encode
a judgment that provably never occurred, and would train the reviewer to stop reporting
findings of that shape
[never-adjudicated is distinct from disagreement](../learnings/1786357056431-approver-human-disagreement-a-finding-held-by-a-re.md),
[a correct prediction, exact diagnosis, and the regression shipped anyway](../learnings/1786357252204-a-finding-held-by-a-tier-that-cannot-publish-it-is.md).

The parallel case slangpy#1068 shows merge is not retroactive proof of *resolution*: a
one-line fix merged with zero new code delta, zero new human signal, and the flagged coverage
gap (the authoritative macOS wheel workflow) *never executed* before or after the merge. Both
"gap closed" and "gap accepted" look identical from `merged: true`, so a naive join installs
an approve-direction drift ("gaps like this turn out fine, weight them less"). The
discriminator is whether the missing signal ever ran, not whether the PR merged; an
`ABSTAIN_INFRA` is not contradicted by a merge that vindicates the *code* while leaving the
*pipeline defect* intact
[merge can ship an unverified change](../learnings/1786361356886-approver-human-agreement-a-merge-can-ship-an-unver.md).

## The read-only publisher gap and the auto-merge clock

The approver's read-only invariant is correct — it should not post its own verdicts — but
that makes "escalate to a write-capable coworker" a load-bearing procedural step with a
deadline. When auto-merge is armed on a PR with an open finding, the clock is the merge
automation's (bounded by the next base-branch update, typically hours), not the review
queue's; check `gh pr view --json autoMergeRequest,reviewDecision,mergeStateStatus` and say
so *in the abstain itself*
[a finding held by a tier that cannot publish it](../learnings/1786357056431-approver-human-disagreement-a-finding-held-by-a-re.md),
[armed auto-merge inverts the urgency model](../learnings/1786357252204-a-finding-held-by-a-tier-that-cannot-publish-it-is.md).

The gap is structural in `live_late` mode: once a PR is merged, a challenger finding stops
being a gate input and becomes **a defect report about `master`**, held by the one tier
contractually unable to publish it — and a `pr_ready_for_review` webhook confers no
post-authorization. The fix is to say "merged before decision" as a first-class report line
(not a `mode: live_late` tag a reader skims) and route the finding as a master-defect
(follow-up issue / triager dispatch), a different chain than the approval one whose terminal
state is a ledger row
[a live_late decision on an already-merged PR has no publisher](../learnings/1786386627465-a-live-late-approval-decision-on-an-already-merged.md).

But before concluding a late abstain "protected nothing," read the *recorded* `ts`. On
slang#12451 the orchestrator computed "~2h late" from the transcript's latest timestamp
(18:19Z), while `decision.md` recorded the verdict at 15:05Z — **71 minutes before** the
16:15:56Z merge. A session that spans a merge has three clocks (decision ts, delivery time,
current-turn wall-clock), and only the first two measure value; the third drifts
unflatteringly forward through re-sends and bookkeeping. Report merge status as its own line
with the recorded time
[read the recorded ts, not the reporting turn's clock](../learnings/1786386868976-approver-human-disagreement-a-decision-s-value-is-.md).

## Label leakage: the merge is the answer key

When a PR merges mid-investigation, the merge state IS the label the decision is graded on
(merged ⇒ APPROVED-equivalent). Consulting it before finalizing is textbook label leakage —
an ABSTAIN would "round up" to WOULD_APPROVE for reasons unrelated to the evidence, and the
result is invisible after the fact. Treat `state`/`mergedAt`/`mergeCommit` as write-only
until the verdict is fixed; the tell you already leaked is a rationale containing "and it
merged anyway." Then use the merge only for the calibration join afterward, strictly
downstream of the recorded decision
[the PR that merges while you investigate hands you the answer key](../learnings/1786381617554-approver-procedure-when-the-pr-merges-mid-investig.md).

## Scoring the outcome, not the process; loudness vs severity

A natural experiment on slangpy#925 validated scope discipline: a critique forced `bugs: 2 → 1`,
excluding a loud reproduced defect (12 red Linux legs from a modular-perl clause) and
retaining a quiet static version-shadowing. The excluded loud defect was **fixed by another
PR within 2h16m** — because it announced itself and recruited a fixer — while the retained
quiet one stayed live. **Loudness and severity are anti-correlated in time-to-fix**: a defect
that requires reasoning about variable precedence does not get onto anyone's list. So the
verdict subject that matters is usually the quiet one; weight a *derived* finding higher than
one you merely watched fail in CI. Also: don't state "defect X is on `main`" from a merged
PR's own diff — re-read `main`, since other PRs land in the interim
[which defect survived is a post-hoc test of scope](../learnings/1786368152690-approver-false-safe-the-defect-i-excluded-from-the.md).

The severity framing still needs its own guard against over-claiming: a peer sharpened the
loudness rule with "the quieter defect is also the more severe (ships mis-versioned wheels to
users)," but tracing the guard on the artifact-producing path showed
`SLANGPY_VERSION_OVERRIDE` is computed only under `build_type=='nightly'` — so the defect
**cannot reach PyPI**; blast radius is Artifactory nightly dev wheels only. The sharpening's
core (loudness predicts *someone else will act*, lowering escalation priority, never truth
value) survives; its supporting severity example does not. Overstating blast radius spends
credibility exactly as understating it does
[narrowing my own BLOCK's severity — nightlies only](../learnings/1786368448586-approver-clause-gap-narrowing-my-own-block-s-sever.md).

And when a resolution arrives with "your verdict was right at decision time," refuse the
exculpation. slang-rhi#824's OPEN_GAP was closed (the premise resolved raytracing-only) — the
*process* was sound (naming the unresolved premise made it cheap for someone to close in ~20
minutes) but the *outcome* was a false abstain, joined as a LOSS. Keeping "process good" and
"outcome wrong" as separate ledger facts is the whole discipline; collapsing them produces
rows that can never disagree with you
[false abstain scored as a LOSS](../learnings/1786374432752-approver-false-safe-amendment-to-the-824-challenge.md).

## Publishing discipline in triage: post the artifact, instrument the park

The same "a finding nobody publishes is invisible" principle governs triage. A correction
retracted an over-generalized rule: a maintainer-authored tracking issue *still gets the
5-bullet* — the no-post exception is process/meta ONLY (no repro, no compiler content, no
`@nv-slang-bot` ask). The discriminator is the issue's CONTENT, not its author or its
blocked-ness; if you produced file:line findings, "nothing to verify" is false by
construction. A "watch-only" disposition governs whether we dispatch a fixer, never whether
the chain has a public footprint
[maintainer tracking issue still gets the 5-bullet](../learnings/1786366151304-correction-maintainer-authored-tracking-issue-stil.md).

Symmetrically, a park whose exit condition is a third party's action installs a *rule, not a
watcher* — nothing polls the issue, and silence looks identical to "correctly waiting." On
slang#9062 a maintainer's re-dispatch request sat 25 days unobserved. When parking on a
condition someone else owns, the note must name WHO CHECKS and HOW OFTEN, or sit behind a
scheduled sweep; prefer an *expiring* park with a re-evaluation date. (Companion tell: an
existing branch/worktree licenses "checked out," never "started" — check for own commits, not
a directory.)
[a park whose exit condition is a third party's action has no instrument](../learnings/1786366210994-a-park-whose-exit-condition-is-a-third-party-s-act.md).

**Source learnings (11):**

- [A finding held by a read-only tier with no write path is functionally identical to no finding — "never adjudicated" ≠ "human disagreed"](../learnings/1786357056431-approver-human-disagreement-a-finding-held-by-a-re.md) — prove the human saw the finding before scoring a mismatch as disagreement; armed auto-merge sets the clock.
- [A finding held by a tier that cannot publish it is identical to no finding](../learnings/1786357252204-a-finding-held-by-a-tier-that-cannot-publish-it-is.md) — exact prediction shipped anyway; merged is an action not a judgment; a closed ledger row does not close an open defect.
- [A merge can ship an unverified change: maintainers accept coverage gaps rather than close them](../learnings/1786361356886-approver-human-agreement-a-merge-can-ship-an-unver.md) — check whether the missing signal ever executed; abstains are not contradicted by merges.
- [The defect I excluded got fixed within 2h16m; the one I blocked on is still live — loudness vs time-to-fix](../learnings/1786368152690-approver-false-safe-the-defect-i-excluded-from-the.md) — which defect survived is a post-hoc test of scope; weight derived findings higher.
- [Narrowing my own BLOCK's severity: version-shadowing cannot reach PyPI, nightlies only](../learnings/1786368448586-approver-clause-gap-narrowing-my-own-block-s-sever.md) — trace the guard on the artifact-producing path; overstating blast radius spends credibility.
- [Amendment to #824: premise resolved raytracing-only — score it a LOSS, refuse the exculpatory framing](../learnings/1786374432752-approver-false-safe-amendment-to-the-824-challenge.md) — keep "process good" and "outcome wrong" as separate ledger facts.
- [When the PR merges mid-investigation, the merge is the LABEL — exclude it from the verdict](../learnings/1786381617554-approver-procedure-when-the-pr-merges-mid-investig.md) — label leakage; treat merge state as write-only until the verdict is fixed.
- [A live_late approval decision on an already-merged PR has no publisher](../learnings/1786386627465-a-live-late-approval-decision-on-an-already-merged.md) — route a merged-PR finding as a master-defect, not an approval outcome.
- [A decision's value is measured against merge time — but read the recorded ts, not the reporting turn's clock](../learnings/1786386868976-approver-human-disagreement-a-decision-s-value-is-.md) — three clocks per merge-spanning session; only the decision ts and delivery time measure value.
- [Maintainer-authored tracking issue still gets the 5-bullet — the no-post exception is process/meta ONLY](../learnings/1786366151304-correction-maintainer-authored-tracking-issue-stil.md) — the discriminator is content, not author; watch-only disposition ≠ no artifact.
- [A park whose exit condition is a third party's action has no instrument behind it](../learnings/1786366210994-a-park-whose-exit-condition-is-a-third-party-s-act.md) — name WHO CHECKS and HOW OFTEN or use a scheduled sweep; prefer an expiring park.
