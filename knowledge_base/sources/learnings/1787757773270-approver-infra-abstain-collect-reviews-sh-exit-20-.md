---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787756730781-7bwa9v
written_at: 2026-08-26T15:22:53.270Z
---

# [approver/infra-abstain] collect-reviews.sh exit 20 drops head-current CodeRabbit SUMMARY comments (issue-comment, not review-object)

## Symptom
On a PR where production `github-actions[bot]` (claude-code-action) skips review
(e.g. `extras/ci/**`, `.github/**`, docs-only), `scripts/collect-reviews.sh`
returns exit 20 with `harvest.json` = `{"found": false}`, and the workflow falls
to "Devin-only." But CodeRabbit HAS reviewed — it just posts its result as a
**walkthrough SUMMARY issue comment** ("No actionable comments were generated in
the recent review. 🎉" + a `Reviewing files that changed ... between <base-sha>
and <head-sha>` block), NOT as a formal PR *review object*. The collector's
review-object path exits before persisting that discovered summary, so a real,
head-current, trusted-bot signal is silently discarded.

## Root cause
`collect-reviews.sh` keys "found a review" on the `pulls/N/reviews` review-object
API. CodeRabbit's summary is an `issues/N/comments` issue comment, so it never
enters that path → exit 20. This is the SAME gap seen on #12618 (there recovered
directly too). It is not a fetch failure (that's exit 21); the data is present,
just on the wrong endpoint for the collector.

## How to catch it
Before writing the tier as "Devin-only / no CodeRabbit," ALWAYS check issue
comments directly:
`gh pr view <pr> --repo <repo> --json comments --jq '.comments[] | select(.author.login|test("coderabbit";"i")) | .body'`
Confirm the summary's `Reviewing files that changed ... between <X> and <HEAD>`
block names your PINNED HEAD (CodeRabbit is head-current) before crediting it.
"0 actionable comments" at the pinned head is a genuine clean secondary signal.

## Fix
Recover the CodeRabbit summary body directly, save it as
`review/coderabbit-review.md`, and describe the tier as **"CodeRabbit-summary +
Devin fallback"**, not "Devin-only." The decision is usually unchanged (0
actionable ⇒ clean), but the tier label and the evidence base must be accurate —
an OUTPUT_REVIEW critique will (correctly) flag "Devin-only" as an overclaim when
a head-current CodeRabbit summary exists. Longer term: `collect-reviews.sh`
should also scan issue comments for the CodeRabbit summary marker
(`summarize by coderabbit.ai`) and persist it even when no review object exists.
