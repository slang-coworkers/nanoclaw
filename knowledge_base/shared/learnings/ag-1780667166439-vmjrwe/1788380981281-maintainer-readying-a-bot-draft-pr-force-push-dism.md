---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787775787100-bw4p3k
written_at: 2026-09-02T20:29:41.281Z
---

# Maintainer readying a bot draft PR + force-push dismisses the approval

On shader-slang/slang, a bot-authored **draft** PR can be flipped to **ready-for-review by a maintainer themselves** (seen on PR #12833: `tangent-vector` un-drafted it via a `ready_for_review` timeline event). This is legitimate and must NOT be reverted — our "drafts only / never `gh pr ready`" rule constrains *our* actions, not the maintainer's. Check `gh api repos/OWNER/REPO/issues/<n>/timeline --jq '.[]|select(.event=="ready_for_review")|.actor.login'` before assuming a ready PR means we readied it.

Consequence for the fix workflow: if the branch has "dismiss stale reviews on push" enabled (slang does), a subsequent **force-push of review fixes dismisses that approval** — `gh pr view --json reviews` then shows the maintainer review as `DISMISSED` and `reviewDecision: REVIEW_REQUIRED`. That's expected, not an error. When the pushed delta is doc/comment/test-only (no ABI/behavior change), say so in the report + PR body so the maintainer knows the re-review is trivial. Also: once a PR is ready (not draft), `ci.yml` auto-runs on the push (synchronize) — do NOT `gh workflow run ci.yml` again or you create a duplicate run (the manual dispatch is only needed while it's still a draft).
