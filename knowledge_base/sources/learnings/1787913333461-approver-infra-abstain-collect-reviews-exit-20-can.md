---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787911949735-xhge9a
written_at: 2026-08-28T10:35:33.461Z
---

# [approver/infra-abstain] collect-reviews exit 20 can hide an in_progress production review check-run

**Symptom.** On a fresh, human-authored slang PR (#12809, opened ~3 min prior), `collect-reviews.sh --repo shader-slang/slang --pr 12809 --commit <head>` returned **exit 20** ("no harvestable bot review AND no review bot still working" → workflow says fall to Devin-only), with `harvest.json = {"found": false}` and **no `pending_bot` field**. But the production review bot was NOT done: the `github-actions` check-run named `review` on that head was `status=in_progress` (started 10:11:21Z; the script ran ~10:14Z). It completed `success` at 10:17:30Z and a re-harvest then returned exit 0 with the primary `github-actions[bot]` review.

**Root cause.** The script's pending-bot detection missed the slang `review` check-run in its `in_progress` state, so it classified a still-running review as a genuine skip (exit 20) instead of a timing race (exit 22). Exit 20 is therefore NOT always a true skip on a fresh PR.

**Why it matters.** Falling to Devin-only on exit 20 here would have discarded the primary production review signal — the exact slang#12064 `harvest_used=0` false-negative the workflow's exit-22 path exists to prevent. Devin only echoed the PR body (0 independent findings), so the primary review was the real signal.

**How to catch it.** Before accepting ANY collect-reviews/harvest exit that says "no bot review + none pending" on a recently-opened PR, independently query the head's check-runs (`gh api repos/OWNER/NAME/commits/<head>/check-runs`) and look for a `review` (github-actions = claude-code-action) check-run still `in_progress`, plus CodeRabbit's commit status. If the `review` check-run is in_progress, WAIT for it to complete (poll ~30s, up to ~6 min) and RE-HARVEST — treat it as exit 22, not 20. A `success`/`skipped` conclusion on `review` distinguishes a genuine skip from a timing race.

**Aside (not a defect).** CodeRabbit legitimately skips PRs whose files are all `docs/generated/**` (its `!**/generated/**` path filter) — its commit status goes `success` with NO review body. That is expected, not a harvestable signal; do not treat CodeRabbit `success` as a review.

**Fix.** Add the head `review` check-run status probe as a guard on the exit-20 branch (or fix collect-reviews.sh to enumerate the `review` check-run into `pending_bot` when in_progress). Until then, do it by hand on every fresh-PR exit 20.
