---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-11T08:34:48.781Z
---

# [approver/infra-abstain] Harvest exit 20 "genuine skip" is indistinguishable from a review still in flight — poll the WORKFLOW RUN, not the check-run name

# A "no primary review" tier decision made 6 minutes too early

**Symptom.** On shader-slang/slang#12446 @`b4dabca51fc6` I synthesized the
review doc at the **fallback tier** (CodeRabbit only), recording that the
production `github-actions[bot]` review was absent. It posted at
**08:20:32Z** — 6 min 9 s after my poll loop ended at 08:14:23Z. The decision
outcome did not change (ABSTAIN_POLICY either way), but the recorded
`source_tier` was wrong, and the primary review contained **two confirmed gaps
I had missed** (see the challenger-miss learning). A tier misclassification is
not cosmetic: it changes which body is the authoritative verdict source, and it
down-rated evidence I later had to revise.

**Root cause — I polled the wrong object.** My loop watched *check-runs whose
name matches `review|claude`* and exited when none were `in_progress|queued`.
On this repo that name-match set resolves to:

- `Claude Code Assistant` → `completed/skipped` (a different workflow)
- `review` → both a `completed/skipped` row **and** an `in_progress` row

The loop's exit condition was "no matching run is pending". It kept firing
correctly for 12 min... and then I stopped it on a **fixed 12-iteration
bound**, not on the signal settling. Meanwhile the authoritative object —
the workflow run `Claude PR Review` from
`actions/runs?head_sha=<sha>` — was `status: in_progress` the whole time and
would have told me plainly that the review was still coming.

**The deeper error: a bounded poll that expires reads exactly like a negative.**
My loop could exit two ways — signal settled, or iterations exhausted — and I
recorded the second as though it were the first. The workflow's own text warns
about this (exit 22 = "timing race on a fresh PR, not a skip") and I still
collapsed timeout into absence, because *both exits leave the same empty
`claude-review.md`*.

**How to catch it.**

- **Poll the workflow RUN, not a check-run name.**
  `gh api "repos/{repo}/actions/runs?head_sha=<sha>"` → find the run whose
  `name` is the review workflow → wait for `status == "completed"`. Names of
  check-runs are ambiguous (multiple rows, skipped duplicates from
  path-filtered triggers); a workflow run has one identity and a terminal
  `status`/`conclusion` field that is only writable once the work is over.
- **A poll that exits on its own iteration cap must record that distinctly
  from a settled negative.** Print/record *why* the loop ended. "No review
  found" and "gave up waiting" are different facts and must not share a code
  path. If a bounded wait expires, the tier is `unknown`, not `fallback`.
- **Cheap dominating check:** before concluding no primary review exists, ask
  whether any workflow run on the head is still `in_progress`. If yes, the
  absence claim has a live refuter and is not yet a fact — absence claims decay,
  and this one decays in minutes.
- **Re-harvest before recording, not just before deciding.** Re-running
  `collect-reviews.sh` at record time cost one call and flipped the tier from
  fallback → primary (exit 0, `login=github-actions[bot]`, `stale=false`).
  On a long session the harvest that shaped your reasoning may be minutes stale
  by the time you write the row.

**Fix.** Recorded r1 artifacts as
`review-doc.r1-fallback-only.md` / `decision.r1-fallback-only.md` and wrote r2
at the primary tier rather than editing history, so the misclassification and
its correction are both auditable.
