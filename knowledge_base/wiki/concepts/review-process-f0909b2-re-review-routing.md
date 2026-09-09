---
title: Re-review scope decisions, cross-round adjudication, and reviewer session routing
type: concept
group: review-process
tags: [slang-pr-review, re-review, round-2, spot-check, diff-hash, cross-round, a2a-redrive, thread-id, synchronize, canonical-thread, overlap-analysis]
source_count: 7
---

## TL;DR

Not every re-wake warrants a full ~$16 three-reviewer re-run, and routing a reviewer
handoff to the wrong session silently strands it. Two clusters:

- **Scope the re-review to the delta.** When round-1 findings were all doc/test/refactor
  (0 bugs) or additive nit-fixes over an already-clean verdict, do a **targeted round-2 of
  the fix delta** — `git diff <r1head> <r2head>` (both commit objects stay fetchable after
  a force-push) — or a read-only source **spot-check** of only the safety-critical touch
  points the verdict rested on. Confirm no functional change leaked in beyond the intended
  fix (grep the non-test code delta for non-comment changed lines) and re-check the full
  touched-file list.
- **The approver's `diff_hash` goes stale once the fixer pushes.** The machine-readable
  json result block in `combined-review.md` is the verdict against the head that WAS
  reviewed; after fixes the head moves and `commit_match` will mismatch — state a
  spot-check is read-only source verification against the PRIOR head, never hand-fabricate
  an exact-head diff_hash.
- **A maintainer "analyze overlap between PR #A and #B" ask is investigation, not the
  code-review pipeline** — answer with file/+/- counts, linked issues, and call-site
  checks, posted as a plain issue comment (not post-review.sh).
- **Cross-round adjudication is the merging reviewer's job.** Reviewer A reviews `gh pr
  diff`, NOT the PR body — a finding resolved by "document as intentional scope in the
  description" is invisible to A on re-review, and Devin's scrape captures only a finding's
  title + file:line, not its reasoning; carry the context and surface FPs with contradicting
  evidence.
- **A reviewer's reused long-lived session is frozen to the FIRST PR's `thread_id`.** A
  fresh Fix Review Request routed there lands unprocessed and an a2a bounce quotes the
  STALE thread — re-drive on the canonical `gh-issue-<owner>/<repo>-<num>` thread, don't
  reuse the stale-threaded session or double-dispatch.
- **A `synchronize` re-wake can be metadata-only** (label, review re-request, CI re-run)
  with NO new commit — verify the head moved before minting a new ledger row.

## When a targeted delta beats a full re-run

Two atoms converge on the same disproportion argument. When a fixer applies round-1
nit-fixes (added tests, reworded comments, renames, struct refactors) over a 0-bug
APPROVE_WITH_NITS, a read-only **source spot-check** of the safety-critical touch points is
the right response, not a full pipeline re-run — on slang#12848 confirming the ballot-CSE
refactor left `ballotsAreEquivalent`'s per-operand pointer-identity comparison unchanged;
and the approver's `diff_hash` in `combined-review.md` is the verdict against the reviewed
head, so once fixes push, `commit_match` mismatches and an exact-head diff_hash is a
human/approver call, never hand-fabricated
[spot-check (not full re-run) for additive nit-fixes; diff_hash goes stale](../learnings/1788198210854-slang-pr-review-spot-check-not-full-re-run-for-add.md).
For a doc/test/refactor round-2 the mechanical recipe is: fetch the new head,
`git diff <r1head> <r2head>` to isolate only the fix delta (both objects fetchable via
`git cat-file -t`), verify each finding is addressed, and grep the non-test code delta
(`grep -E '^[+-]' | grep -vE '^[+-]{3} |comment|blank'`) to confirm no functional change
leaked — if the survivors are a behavior-preserving refactor plus comments/docs/tests, the
runtime behavior is identical to what was approved and re-review is trivial
[Round-2 re-review of a doc/test/refactor fix = targeted diff, not a full re-run](../learnings/1788381184331-round-2-pr-re-review-of-a-doc-test-refactor-fix-ta.md).
Distinct from a re-review entirely: a maintainer tagging the bot to "analyze overlap /
redundancy between PR #A and #B" is a comparative *investigation* (fits `/slang-plan`
research mode), NOT the three-reviewer code-review pipeline — answer with each PR's
`files,additions,deletions`, linked issues, and whether either touches the other's call
site, posted as a plain issue comment mentioning the reviewer (not post-review.sh), and note
`gh api ... --method POST` works even when `gh auth status` warns "token invalid"
[Maintainer 'analyze overlap between two PRs' ask ≠ /slang-pr-review pipeline](../learnings/1788213763620-maintainer-analyze-overlap-between-two-prs-ask-sla.md).

## Cross-round adjudication carries context the reviewers cannot

On a multi-round review the merging reviewer owns cross-round memory that the individual
reviewers lack. Reviewer A reviews `gh pr diff`, not the PR body, so a round-1 finding
resolved by "document this as an intentional scope limit in the description" is invisible to
A on re-review — A re-examines the unchanged code and may re-raise or silently drop it, so
the human must adjudicate explicitly ("reappeared in A's raw output but is the documented,
A-accepted scope limit") and warn the fixer in advance. Devin's anonymous scrape captures
only a finding's title + file:line, not its reasoning, and flags behavior not the PR body, so
a documented/intentional scope reads as a "Bug"; when Devin flags code byte-identical to a
prior cleared round and A's IR-correctness/test-coverage subagents + C + a passing regression
test all converge, treat it as a false positive but still SURFACE it with the contradicting
evidence and note the scrape didn't capture the reasoning
[adjudicating Devin bugs + cross-round context (Reviewer A can't see the PR body)](../learnings/1788907887233-slang-pr-review-adjudicating-devin-bugs-cross-roun.md).

## Reviewer session routing: stale threads and metadata-only re-wakes

Reviewer/approver coworkers run a long-lived reused session whose `thread_id` is frozen to
the FIRST PR it ever handled. A later Fix Review Request routes into that same session and
lands unprocessed, and when the wake hits a transient a2a provider error it bounces
(`bounced-unknown`) citing the session's STALE thread label — so the `[a2a-redrive]` bounce
names a thread (e.g. `slang-11987`) unrelated to the recipient's current work (PR #12900 for
issue #12861), and the originator doesn't connect the two. Diagnose (orchestrator, global
scope) by mapping the target agent id → coworker (`ncl groups list`), reading the target
session (`ncl sessions messages <sid>` — the newest `[Fix Review Request]` reveals the real
PR and its unanswered state), then re-drive on the **canonical** `gh-issue-<owner>/<repo>-<num>`
thread, which mints a correctly-keyed reviewer session and fixes per-issue observability
[a2a-redrive bounce citing a reused reviewer session's stale thread](../learnings/1788468189401-a2a-redrive-bounce-citing-a-reused-reviewer-sessio.md).
The fixer-side view of the same incident adds the root of the mislabel: a Fix Review Request
whose `thread_id` was derived from a **non-GitHub inbound** (e.g. `in_reply_to=<admin-DM-id>`)
lands in the stale-labeled reviewer session — a GitHub-work reviewer dispatch MUST be keyed to
the canonical `gh-issue-...` thread (anchor to a canonical-thread webhook inbound, or pass
`thread_id="gh-issue-..."` explicitly), and if the orchestrator re-drives it, do NOT also
re-dispatch to the reviewer (double-review race)
[Fix Review Request can bounce/misroute into a reviewer's stale-labeled reused session](../learnings/1788468324330-fix-review-request-can-bounce-misroute-into-a-revi.md).
Finally, a `synchronize`/PR-update webhook does not imply a new commit: on slang#12840 the
orchestrator dispatched "new commits since rev4 at 84532584" but `gh pr view --json headRefOid`
showed the head STILL `84532584` — the `updatedAt` reflected only a new label, a review
re-request (`reviewDecision` APPROVED→REVIEW_REQUIRED), and a CI re-run. Verify the head moved
before deciding; an unchanged head is the SAME revision (`record_decision` is first-write-wins
per (repo,pr,commit)), so re-affirm the standing decision and surface the false premise rather
than manufacturing a rev N+1 (still re-check live clause state — CI can flip on the same commit,
and a red downstream check may be a cross-repo release-ordering gate, not a defect)
[A 'synchronize' re-wake can be metadata-only — verify the head moved before deciding](../learnings/1788556078923-approver-ops-a-synchronize-re-wake-can-be-metadata.md).

**Source learnings (7):**
- [spot-check (not full re-run) for additive nit-fixes; diff_hash goes stale](../learnings/1788198210854-slang-pr-review-spot-check-not-full-re-run-for-add.md) — read-only source spot-check of load-bearing touch points; never hand-fabricate an exact-head diff_hash.
- [Round-2 re-review of a doc/test/refactor fix = targeted diff, not a full re-run](../learnings/1788381184331-round-2-pr-re-review-of-a-doc-test-refactor-fix-ta.md) — git diff r1..r2 (both objects fetchable); grep the code delta to prove no functional leak.
- [Maintainer 'analyze overlap between two PRs' ask ≠ /slang-pr-review pipeline](../learnings/1788213763620-maintainer-analyze-overlap-between-two-prs-ask-sla.md) — comparative investigation with file/+-/issue/call-site evidence; post a plain issue comment, not post-review.sh.
- [adjudicating Devin bugs + cross-round context (Reviewer A can't see the PR body)](../learnings/1788907887233-slang-pr-review-adjudicating-devin-bugs-cross-roun.md) — A reviews the diff not the body; Devin scrape lacks reasoning; surface converged FPs with contradicting evidence.
- [a2a-redrive bounce citing a reused reviewer session's stale thread](../learnings/1788468189401-a2a-redrive-bounce-citing-a-reused-reviewer-sessio.md) — reused session frozen to first PR's thread; re-drive on the canonical gh-issue thread, don't reuse the stale one.
- [Fix Review Request can bounce/misroute into a reviewer's stale-labeled session](../learnings/1788468324330-fix-review-request-can-bounce-misroute-into-a-revi.md) — key GitHub reviewer dispatches to the canonical thread, not a DM-derived one; don't double-dispatch after a re-drive.
- [A 'synchronize' re-wake can be metadata-only — verify the head moved](../learnings/1788556078923-approver-ops-a-synchronize-re-wake-can-be-metadata.md) — label/review-request/CI-rerun events don't move the SHA; re-affirm, don't mint a new ledger row for an unchanged head.
