---
title: "[approver/infra-abstain] harvest exit-0 on SECONDARY (CodeRabbit) while production review check-run still in_progress = wait + re-harvest, don't settle for fallback tier"
type: learning
topic: review-approval
source: learnings/1784113859103-approver-infra-abstain-harvest-exit-0-on-secondary.md
---

# [approver/infra-abstain] harvest exit-0 on SECONDARY (CodeRabbit) while production review check-run still in_progress = wait + re-harvest, don't settle for fallback tier

**Symptom:** On a freshly-opened slang PR (#12117, opened ~10:41Z), `harvest-reviews.py` returned **exit 0** — but it had selected the **secondary** `coderabbitai[bot]` review (posted 10:46Z), because the **primary** `github-actions[bot]` production review had not posted yet. Exit 0 does NOT guarantee the primary tier; the script takes whatever bot review exists, and CodeRabbit posts minutes after open while the production claude-code-action pipeline takes 15-25+ min.

**Root cause:** The exit-code contract distinguishes exit-22 (no bot review yet, but a review bot is *named as pending*) from exit-0 (a bot review was harvested). But exit-0 can still mean "only the *secondary* landed." Falling to the CodeRabbit/Devin fallback tier here would discard the strongest signal (the production review), the same class of miss as the slang#12064 exit-22 `harvest_used=0` bug — just via a different exit code.

**How to catch it:** After ANY harvest, check `harvest.json.login`. If it is NOT `github-actions[bot]`, do not assume the primary is absent — probe the production pipeline directly:
- `gh api repos/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="review") | "\(.status):\(.conclusion)"'` — the `review` check-run (app=github-actions) IS the `claude-pr-review.yml` pipeline. `in_progress` ⇒ the primary review is imminent; WAIT.
- Poll for a `github-actions` entry in `gh pr view <pr> --json reviews` OR the `review` check-run going `completed`, up to ~40 min (25-45 min window on a fresh PR), then re-harvest. Re-harvest exit 0 with `login=github-actions[bot]` = primary tier secured.
- The two `Claude Code Assistant` check-runs showing `skipped` are the mention-triggered variant — a known RED HERRING, not the PR-review pipeline. Never read them as "production review was skipped."

**Fix:** Treat harvest exit-0-with-secondary-login the same as exit-22: wait for the production `review` check-run to settle, then re-harvest. Only fall to CodeRabbit/Devin fallback if the production pipeline genuinely terminates without a review (skipped/absent). Related: [[pr-12105-decided]] ("Claude Code Assistant=skipped is a red herring; real github-actions review posts 25-45min later"), slang#12064 exit-22 timing-race anchor.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784113859103-approver-infra-abstain-harvest-exit-0-on-secondary.md`_
