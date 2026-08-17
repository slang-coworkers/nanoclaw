---
title: "[approver/infra-abstain] harvest exit-0 can pick CodeRabbit secondary while the primary prod review is still in_progress — re-harvest, do not settle"
type: learning
topic: review-approval
source: learnings/1784117112458-approver-infra-abstain-harvest-exit-0-can-pick-cod.md
---

# [approver/infra-abstain] harvest exit-0 can pick CodeRabbit secondary while the primary prod review is still in_progress — re-harvest, do not settle

**Symptom:** On a freshly-opened PR (slang#12118, opened 11:41, all `tools/compile-perf/*.py`), the first `harvest-reviews.py` run returned **exit 0** at 11:43 but harvested `coderabbitai[bot]` (secondary) — CodeRabbit is fast and posts first. The **primary** `github-actions[bot]` production review (`.github/workflows/claude-pr-review.yml`, the `review` check-run) was still `in_progress` (started 11:40:10Z) and hadn't posted yet. Exit 0 does NOT guarantee the primary was harvested — it only means *a* matching review at the pinned head was found.

**Root cause:** harvest exit codes 22/21 signal "no review yet / fetch failed", but there is no distinct code for "found the secondary while the primary is still running." A naive read of "exit 0 ⇒ done" settles for CodeRabbit and discards the primary claude-code-action signal (the slang#12064 `harvest_used=0` class of miss).

**How to catch it:** After harvest, check `harvest.json.login`. If it's `coderabbitai[bot]` (not `github-actions[bot]`) on a PR where production review is NOT skipped, inspect the check-runs: `gh api repos/<repo>/commits/<sha>/check-runs --jq '.check_runs[]|select(.name=="review")|.status'`. Note: the three `Claude Code Assistant` check-runs show `skipped` even when the real review runs — the authoritative signal is the **`review`** check-run whose workflow is `.github/workflows/claude-pr-review.yml` (confirm via `gh api .../actions/runs/<id> --jq .path`). If that job is `in_progress`, **WAIT** for it to reach `completed`, then re-run `harvest-reviews.py` — it will then return exit 0 with `github-actions[bot]` primary.

**Fix:** Treat "harvest picked the secondary while the primary `review` job is in_progress" exactly like exit-22: poll the `review` check-run (~30s cadence, up to ~6–9 min) and re-harvest on completion. Only fall to the secondary/Devin if the primary job never settles or genuinely skipped (all `Claude Code Assistant` skipped AND no `review` job for claude-pr-review.yml). Confirmed pattern across slang#12117, #12109, #12098 — waiting out the in_progress prod review consistently upgrades secondary→primary.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784117112458-approver-infra-abstain-harvest-exit-0-can-pick-cod.md`_
