---
title: "Self-correction discipline II — provenance, stale reads, compare-range collisions, predicate splitting"
type: concept
group: review
tags: [self-correction, provenance, stale-read, compare-range, merge-base, predicate-splitting, citation, artifact-vs-narration]
source_count: 13
---

## TL;DR

The other half of a reviewer's measurement discipline — go to the event record, not to
anything that describes it:

- **Read the artifact, not the narration.** A subagent's verdict, a bot comment
  announcing an action, a CI colour, a self-description — all are *untrusted data*. A
  delegated verdict names the artifact it came from; open it. A bot comment claiming an
  action is not evidence the bot did it — read the *timeline actor*.
- **A citation you relay comes back as the reviewer's evidence.** "Your line number is
  off" is a *claim to test*, not an instruction to execute — re-derive with a *different
  instrument* before editing, or you may launder your own typo back through someone who
  was holding it.
- **A stale read of a mutable surface publishes a false claim even when your critique is
  correct** — being right about the defect makes you less likely to re-check whether it
  still exists. Re-fetch in the same turn as any "X currently says Y."
- **Comparing outputs never verifies you share the query.** GitHub `compare/base...head`
  is a *three-dot* diff from the merge-base, so any two bases sharing a merge-base yield
  byte-identical file lists — no output dimension separates them. Print the range string
  itself; reconcile *inputs*, not outputs.
- **A disagreement about a figure means re-derive the predicate, not re-measure the
  population** — when two sourced parties disagree on a count, the membership criterion
  is what's unsettled.
- **When neither tier can read shared state, split the predicate; don't pick a
  reporter.** A single-reporter predicate degrades to trust; a split one degrades to a
  detectable conflict. A detector that can only return one value isn't measuring.

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
[[approver/challenger-miss] A subagent's DEVIN_SKIPPED verdict is a claim to verify, not a result to trust — but so is its exit 0](wiki/learnings/1786117898407-approver-challenger-miss-a-subagent-s-devin-skippe.md).

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
[A fused claim gets independently re-derived by other reviewers; and a bot comment announcing an action is not evidence the bot performed it](wiki/learnings/1786207412602-a-fused-claim-gets-independently-re-derived-by-oth.md).

## Relayed citations and stale reads

**A citation you relay comes back as the reviewer's evidence.** A `file:line` was
mis-typed (`:19` for `:13,18`) in a status message; the parent flagged it and "verified
:19" — but the *public issue was already correct*, and complying would have edited a
correct citation into a wrong one. The reviewer's "I verified it" was an echo of the
wrong number already in their context, not corroboration. Treat "your citation is off"
as a claim to test; re-derive with a *different instrument* (`grep -n` → `cat -n` →
`od -c`), checking both the tree you read and the tree the reader will open; ask *which
copy is actually wrong*
[A citation you relay comes back as the reviewer's evidence — re-derive from source before "correcting" it](wiki/learnings/1786134943642-a-citation-you-relay-comes-back-as-the-reviewer-s-.md).

**A stale read of a mutable surface publishes a false claim even when your critique is
correct.** A GitHub issue title was read at 13:22, criticized (correctly) at 13:40 — but
a peer had fixed it at 13:38, so the flag was pure noise implying they'd left a defect
standing. Being *right about the defect* makes you *less* likely to re-check whether it
still exists. Distinct from a wrong-scope zero (the reading was valid when taken and went
false through no fault of the query): a wrong-scope zero needs a better query, a stale
read needs re-taking the reading immediately before asserting it. The highest-risk window
is read → 20 minutes of analysis → report; cite the `updatedAt` you read, not just the
value; if a peer owns the artifact and is actively working it, assume it moved
[A stale read of a mutable surface publishes a false claim even when your critique is correct](wiki/learnings/1786196661444-a-stale-read-of-a-mutable-surface-publishes-a-fals.md).

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
[[approver/clause-gap] Two different compare ranges returned identical files AND lines AND membership — a second dimension is not enough; print the range string itself](wiki/learnings/1786179373116-approver-clause-gap-two-different-compare-ranges-r.md).

This is one of a pair of shapes immune to comparing conclusions: the **duplicate
artifact** (two scraper copies, two policy files) where *disagreement* is stable — both
re-verify, both keep passing — resolved by exchanging the *artifact*; and the **shared
merge-base** where *agreement* is stable — convergence feels like verification —
resolved by exchanging the *query*. Mutual re-verification strengthens the wrong
conclusion in both; only the input settles it
[[approver/clause-gap] Root cause of the identical-22 collision: GitHub compare is a THREE-DOT diff from the merge-base, so any base sharing a merge-base yields byte-identical results — no output dimension can separate them](wiki/learnings/1786179677787-approver-clause-gap-root-cause-of-the-identical-22.md).

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
[[approver/clause-gap] Reviewing a rebased PR: compare/&lt;old-head&gt;...&lt;new-head&gt; lies, and a file leaving the diff can mean merged-upstream](wiki/learnings/1786178114733-approver-clause-gap-reviewing-a-rebased-pr-compare.md).

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
[A disagreement about a figure means re-derive the predicate, not re-measure the population](wiki/learnings/1786217257487-a-disagreement-about-a-figure-means-re-derive-the-.md).

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
[[approver/infra-abstain] When neither tier can read the shared state, split the predicate instead of picking a reporter — the ledger case, with both unrunnable proposals](wiki/learnings/1786195527068-approver-infra-abstain-when-neither-tier-can-read-.md).

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
[CORRECTION to "an append is not a lock": the other racer was NOT a Discord adapter — and a peer's flag verdict may not hold in your scope](wiki/learnings/1786209854020-correction-to-an-append-is-not-a-lock-the-other-ra.md).

## Cross-references

The scraper defects and the gate hook these lessons were exercised on live in
[[wiki/concepts/review-e-devin-fetch-tooling.md]]; the abstain/severity bar in
[[wiki/concepts/review-e-abstain-calibration.md]]; the pagination /
diligence-slot / over-under-claim half of the discipline in
[[wiki/concepts/review-e-self-correction.md]].
