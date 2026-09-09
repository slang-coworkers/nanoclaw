---
title: Harvest exit codes & timing races — exit 20/10 is provisional, poll the workflow run
type: concept
group: review-process
tags: [collect-reviews, harvest-exit-codes, timing-race, workflow-run, check-runs, stale-review, coderabbit, approver]
source_count: 9
---

## TL;DR

`collect-reviews.sh`/`harvest-reviews.py` return exit codes (0 primary, 10 stale,
20 genuine-skip, 22 wait) that the approver's tier logic routes on. Every atom
here shows those codes are **claims about a search at one instant, not facts about
the world** — and the cheap failure direction is always the one that *discards the
best review signal*.

Recurring failure shapes:

- **Exit 20 races an in-flight producer.** On a freshly-opened PR the production
  `review` check-run can be `in_progress` (~5-6 min window) but not classified as
  `pending_bot`, so harvest returns 20 (skip) instead of 22 (wait). A bounded poll
  that *expires* reads identically to a settled negative. Fix: poll the **workflow
  RUN** (`actions/runs?head_sha=<FULL sha>` → wait for `status==completed`), not a
  check-run name; record *why* the loop ended; re-harvest at record time.
- **Exit 10 (stale) hides a completed head-current re-review.** CodeRabbit posts an
  incremental re-review as an updated **summary comment** + green commit status,
  and does not always mint a fresh formal *review object* — so the harvester keys
  on the stale object and reports stale. Grep `coderabbit-review.md` /
  `commits/<head>/status` for a `recent_review` block whose "between X and Y"
  footer names the pinned head.
- **A green production review can have posted NOTHING.** The check reports the
  *harness* ran, not that a *review object* exists — an agent that ended its turn
  waiting on subagents exits 0 through `Post PR Review`. A crashed review likewise
  leaves no artifact but recoverable findings in the CI job log.
- **`actions/runs?head_sha=` silently returns `total_count=0` for a 12-char sha** —
  the exact query used to decide "is a bot still running". Resolve the FULL 40-char
  sha first (`${#FULL} -eq 40`) and corroborate against `commits/<sha>/check-runs`.
- **Truncated fetches.** A 30-item default page hid the pending `review` check-run
  among 49; a page is not a set — compare `fetched` against `total_count`.

Master rule: **when a green result / empty set and a missing-or-present artifact
disagree, the artifact wins. A negative from an artifact probe is a claim about the
artifact, not the work.**

## Exit 20/22: the timing race and the object you poll

Exit 20 means "no harvestable bot review AND no review bot still working" — the
legitimate Devin-only tier for fixer/bot-authored PRs where production review is
skipped by design. But it is **indistinguishable from a review still in flight**.
On slang#12446 the review posted 6 min 9 s after the poll loop ended: the loop
watched *check-runs whose name matches `review|claude`* and exited on a fixed
12-iteration bound, not on the signal settling — and "a bounded poll that expires
reads exactly like a negative". Check-run names are ambiguous (multiple rows,
skipped duplicates from path-filtered triggers); the authoritative object is the
**workflow run** from `actions/runs?head_sha=<sha>`, which has one identity and a
terminal `status`/`conclusion`. Record *why* the loop ended — "no review found" and
"gave up waiting" are different facts that must not share a code path — and
**re-harvest at record time**, since a long session's harvest may be minutes stale
[harvest exit 20 is indistinguishable from a review in flight — poll the workflow run](../learnings/1786437288781-approver-infra-abstain-harvest-exit-20-genuine-ski.md).
The same race on slang#12521: exit 20 at 07:09, production review landed 07:14:43Z;
the fix is to check the head's check-runs for an `in_progress` run named `review`
(app `github-actions`) before accepting exit 20 as terminal — "a negative from a
collector that races an asynchronous producer is provisional; probe the producer's
own liveness signal before acting on the absence" [harvest exit 20 can be a timing race](../learnings/1786607561089-approver-infra-abstain-harvest-exit-20-can-be-a-ti.md).

**The abbreviated-sha trap that seeds the false negative.** `actions/runs?head_sha=`
requires the FULL 40-char sha; a 12-char one returns a well-formed `200` with
`total_count=0` — no error, no 404. `check-runs` and `commits/<ref>/status` both
resolve an abbreviated ref, so the short sha works everywhere else, which is why
this one endpoint's silent zero is easy to trust. The approver's own workspace
convention is `work/<pr>-<sha12>/`, so **a 12-char sha is the value nearest to
hand** — not a typo, the default. The zero "arrives in the costume of a finding"
(an empty set reads as "nothing pending — proceed"), so nothing in the reasoning
trips. Fix: resolve the FULL sha from `headRefOid`, assert `${#FULL} -eq 40` *before*
the query, and corroborate a zero against `commits/<sha>/check-runs` (which returned
51 rows for the same head) [actions/runs?head_sha= silently returns 0 for an abbreviated sha](../learnings/1786451761036-approver-infra-abstain-actions-runs-head-sha-silen.md).

## Exit 10 (stale) is not the whole story — read the summary comment

Exit 10 (stale review objects only) is explicitly **not** an abstain: ignore the
stale object, fall to head-current Devin, note the staleness. On slangpy#1050 the
two CodeRabbit reviews were 35 days behind head — "findings against a stale commit
are neither evidence of a bug nor evidence of its absence", so on long-lived PRs
budget for the Devin tier being the only real signal and judge staleness by
**commit distance, not timestamp age** [long-lived PRs outrun their bot reviews — exit 10 is the norm](../learnings/1786376517986-approver-infra-abstain-long-lived-prs-outrun-their.md).

But exit 10 can *hide a clean, complete, head-current re-review*. CodeRabbit posts
an incremental re-review of a force-pushed head as an updated **summary comment**
(the `<!-- recent_review_start -->` block) + a green commit status, without always
minting a fresh formal review object — so the harvester keys on the lingering old
object and reports stale. On slangpy#1106 the head-current signal lived in the
combined status (`CodeRabbit success, "Review completed"` at the exact head) and the
summary comment (Run ID, "Reviewing files … between base and c72b18c04123 → No
actionable comments 🎉"); the fix is to check both surfaces on exit 10/22 and, when
clean+complete, set `reviewers_complete=true` — "fallback-with-a-real-review, NOT
NO_REVIEW_SIGNAL" [CodeRabbit stale review OBJECT hides a completed head-current re-review](../learnings/1786634209947-approver-clause-gap-coderabbit-stale-review-object.md).
The slang-rhi#839 R2 twin is caught only because the DECISION_REVIEW critique read
`coderabbit-review.md` directly: `collect-reviews.sh` is a superset of
`harvest-reviews.py` and *does* capture the summary comment into that file, whose
`recent_review` block named the exact head interval and read "No actionable
comments 🎉". The discriminator: **does a `recent_review` footer name the pinned
head? Yes → head-current signal exists; no → truly stale/Devin-only** — and this is
distinct from slang-rhi#836 (a green *status* with no matching `recent_review` body =
genuinely un-reviewed) [harvest exit 10 can hide a CLEAN head-current re-review in the summary comment](../learnings/1786637614095-approver-infra-abstain-harvest-exit-10-stale-can-h.md).

## Green harness, missing artifact — the artifact wins

A green production review check-run is **not** evidence a review was posted. On
slang#12136 the `review` check-run was `completed/success` with all 10 steps green
(including `Post PR Review`), yet no review object, issue comment, or inline comment
existed at that head — the agent had dispatched its six subagents and *ended its
turn to wait for them*, and an agent turn that ends cleanly is a successful CLI
invocation, so every subsequent step succeeded with nothing to post. "The check
reports whether the *harness* ran, not whether a *review object* exists" — verify
`pulls/N/reviews` for a row whose `commit_id` == the pinned head, and treat exit 10
on a PR with recent bot activity as needing a second look (it cannot distinguish
"skipped this revision" from "ran and produced nothing") [a production review check-run can go GREEN having posted NOTHING](../learnings/1786400661803-approver-infra-abstain-a-production-review-check-r.md).

A **crashed** review is the sibling case: on slang#12459 the `review` job's
conclusion was `failure` (`API Error: Connection lost mid-response` while
aggregating, after 28 turns), so it posted nothing and the harvest saw nothing —
but the CI job log held a full recoverable finding set (1 hedged 🔴, 3 🟡, 1 🔵) and
even revealed *which lens was missing* (`ir-correctness-reviewer` cut off
mid-sentence). "The tier table's exit codes enumerate *harvest* outcomes, not
*review-run* outcomes — there is no exit code for 'ran and died', so it degrades to
the same branch as 'never ran'." A crashed review is still `reviewers_complete:
false` (recovered partials do not restore a complete signal), but mine the log so
the human inherits the work, and distinguish "never ran" from "ran and died"
[a crashed production review still holds recoverable findings in its CI job log](../learnings/1786455506297-approver-infra-abstain-a-crashed-production-review.md).

## The truncated fetch — a page is not a set

On slang#12455 `collect-reviews.sh:62` fetched check-runs unpaginated with no
`per_page`, getting the default 30 of 49; the pending `review` check-run sat outside
the first page, so exit 22 (wait) was downgraded to exit 20 (skip) — "the page-cap
makes a pending bot look absent, failing toward *discarding the best review input*,
silently, with a success exit code". The generic control: before trusting any
"nothing pending" answer, compare the independent scalar `total_count` against the
fetched length; and "an exit code whose documented precondition doesn't match the PR
in front of you is a claim to verify, not a fact to route on" (a human MEMBER opened
this on a same-repo branch, matching no documented skip class) [collect-reviews.sh misses the pending review bot — 30-item page](../learnings/1786382286523-approver-infra-abstain-collect-reviews-sh-misses-t.md).

**Source learnings (9):**

- [long-lived PRs outrun their bot reviews — harvest exit 10 is the norm](../learnings/1786376517986-approver-infra-abstain-long-lived-prs-outrun-their.md) — 35-day drift on slangpy#1050; findings against a stale commit are evidence of neither bug nor absence; judge staleness by commit distance not timestamp age.
- [collect-reviews.sh misses the pending review bot — 30-item default page (49 total)](../learnings/1786382286523-approver-infra-abstain-collect-reviews-sh-misses-t.md) — the truncated fetch downgrades 22→20; a page is not a set, compare fetched vs total_count; an exit code whose precondition doesn't match the PR is a claim to verify.
- [a production review check-run can go GREEN having posted NOTHING](../learnings/1786400661803-approver-infra-abstain-a-production-review-check-r.md) — the agent ended its turn waiting on subagents; the check reports the harness ran, not that a review object exists; verify `pulls/N/reviews` at the pinned head.
- [harvest exit 20 is indistinguishable from a review in flight — poll the workflow RUN](../learnings/1786437288781-approver-infra-abstain-harvest-exit-20-genuine-ski.md) — a bounded poll that expires reads like a negative; poll `actions/runs` not a check-run name; record why the loop ended; re-harvest at record time.
- [actions/runs?head_sha= silently returns total_count=0 for an ABBREVIATED sha](../learnings/1786451761036-approver-infra-abstain-actions-runs-head-sha-silen.md) — the query used for "is a bot still running" fails closed on a 12-char sha (the workspace-path default); assert `${#FULL} -eq 40`; corroborate against check-runs.
- [a crashed production review still holds recoverable findings in its CI job log](../learnings/1786455506297-approver-infra-abstain-a-crashed-production-review.md) — no exit code for "ran and died" so it degrades to "never ran"; mine the log; still `reviewers_complete:false`; distinguish never-ran from ran-and-died.
- [harvest exit 20 can be a timing race — check for an in_progress `review` check-run](../learnings/1786607561089-approver-infra-abstain-harvest-exit-20-can-be-a-ti.md) — exit 22 keys on `pending_bot`; a fresh PR's `review` run isn't classified as pending; probe the producer's liveness before acting on the absence.
- [CodeRabbit stale review OBJECT hides a completed head-current re-review (exit 10)](../learnings/1786634209947-approver-clause-gap-coderabbit-stale-review-object.md) — re-review lives in the summary comment + commit status, not a fresh review object; on clean+complete set `reviewers_complete=true`, not NO_REVIEW_SIGNAL.
- [harvest exit 10 can hide a CLEAN head-current re-review in the summary comment](../learnings/1786637614095-approver-infra-abstain-harvest-exit-10-stale-can-h.md) — grep `coderabbit-review.md` for a `recent_review` block; the discriminator is whether its "between X and Y" footer names the pinned head.
