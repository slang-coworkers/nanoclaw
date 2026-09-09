---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-08-10T22:24:21.803Z
---

# [approver/infra-abstain] A production review check-run can go GREEN having posted NOTHING — every step succeeds while the agent ends its turn waiting for subagents

## Symptom

shader-slang/slang#12136 @`25d3e44ed532` (2026-08-10). The production claude-code-action review
ran **at the pinned head** and passed every gate:

- check-run `review` id `93467134740`, run `31392435030`, `head_sha` == the pinned head
- `status: completed`, `conclusion: success`, completed `13:25:06Z`
- **all 10 steps green**, including the step literally named `Post PR Review`

And yet **no review object, no issue comment, and no inline comment exists at that head.**
`reviews[]` = 41 rows, newest `2026-08-05` @`50d050f82871`; `pulls/N/comments` = 62 rows, newest
`original_commit_id` `50d050f82871`. `collect-reviews.sh` correctly returned **exit 10 (stale
only)** — but "stale" undersells it: there is no primary signal for this revision at all.

## Root cause

Read from the job log's own result payload (`actions/jobs/<id>/logs`, `curl -sSL`, fresh):

```json
"terminal_reason": "completed", "subtype": "success", "num_turns": 23, "is_error": false,
"result": "Clarity candidates are recorded. ... Now I'll wait for the six background reviewers
           to complete before consolidating and filtering. I'll pause here until the reviewer
           notifications arrive."
```

The review agent dispatched its six subagents, then **ended its turn to wait for them**. An agent
turn that ends cleanly is a *successful* CLI invocation, so the action exited 0, so every
subsequent step — including `Post PR Review`, which posts whatever the agent produced (nothing) —
succeeded. There is no failure anywhere for CI to report.

## How to catch it

- **A green review check-run is NOT evidence that a review was posted.** The check reports whether
  the *harness* ran, not whether a *review object* exists. Verify the artifact directly:
  `pulls/N/reviews` for a row whose `commit_id` == the pinned head.
- **`harvest exit 10` deserves a second look on a PR with recent bot activity.** Exit 10 means
  "stale reviews exist"; it cannot distinguish *"the review bot skipped this revision"* from
  *"the review bot ran and silently produced nothing."* Resolve it by checking whether a review
  check-run exists **at the pinned head** — if one is green and no review object exists, that is a
  harness defect worth naming in the decision doc.
- ⭐ The general shape, and the one to keep: **when a green result and a missing artifact
  disagree, the artifact wins.** A pipeline reports on its own execution; only the artifact
  reports on the work. Same family as *green over zero compiled jobs* (a combined `/status`
  folding a CLA stamp into `success`) and *running a harness ABOUT code is not running the code*.
- **Do NOT let this become an abstain by itself.** Per the skill, absent bot reviews are not an
  abstain — decide from Devin, and record the missing primary as *input-quality context* that
  reinforces a conservative lean rather than creating a verdict. Only *no bot review AND no Devin*
  is `NO_REVIEW_SIGNAL`.

## Fix

When `collect-reviews.sh` returns 10 or 20, check for a review check-run at the pinned head
before falling to Devin-only. If one is green with nothing posted, state it explicitly in the
synthesized doc and the ledger `challenger` field — quoting `terminal_reason` and the agent's
final text — so a human sees that a substantial change was decided on a single reviewer, and so
the review-harness bug gets an owner instead of being absorbed silently as "stale".
