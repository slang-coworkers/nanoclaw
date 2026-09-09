---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788160103044-c8efqg
written_at: 2026-08-31T07:25:49.996Z
---

# [approver/infra-abstain] harvest exit-20 conflates a FAILED production review with a genuine skip (diff >300 files → HTTP 406 too_large)

## Symptom
On shader-slang/slang#12846 (a ~972-file test-idiom migration), `collect-reviews.sh` / `harvest-reviews.py` returned **exit 20** (`{"found": false}`) — which the /slang-pr-approve workflow documents as "no harvestable bot review AND no review bot still working (production genuinely SKIPS this class) → fall to Devin-only." But production did **not** skip: the `Claude PR Review` workflow (`claude-pr-review.yml`) actually RAN on the head and **FAILED**.

## Root cause
The production review failed at its **"Pre-stage PR diff and context"** step:
```
gh pr diff "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" > tmp/pr-diff.patch
→ could not find pull request diff: HTTP 406: … the diff exceeded the maximum number of files (300) … PullRequest.diff too_large
```
GitHub's `.diff` media type refuses a diff with >300 files. The pipeline exits 1 before the reviewer runs, so **no `github-actions[bot]` review is ever posted**. harvest-reviews.py sees "no review posted, no check-run still pending" and returns exit 20 — indistinguishable, by its current logic, from a PR production intentionally skips (fixer branches, bot PRs, Claude branches). This is the **exit-21 situation in substance** (a real review was intended behind an infra error), not exit-20.

## How to catch it
Before trusting an exit-20 "genuine skip", check whether the production review actually ran and failed:
- `gh run list --repo <repo> --branch <head> --json name,conclusion,headSha` → look for `Claude PR Review` with `conclusion=failure` on the pinned head.
- Or `gh pr view <pr> --json statusCheckRollup` → a `review` check with `conclusion=FAILURE` (not SKIPPED) means it tried and broke.
- The tell for THIS failure mode: the failing step is "Pre-stage PR diff and context" and the log carries `PullRequest.diff too_large` / `HTTP 406`. Any PR with >300 changed files will hit it.

## Consequence for the decision
Exit-20 → Devin-only is still workable IF Devin completes (it did here, clean). But you must record the primary review as **infra-absent**, not skipped, and surface it (it alerts): the production reviewer is structurally blind to any PR >300 files. Here the decision was independently `ABSTAIN_POLICY (CLAUSE_FAIL:tier_eligible)` because ~972 files >> the 150-file cap, so the size gate tripped first — but on a large PR *within* the size cap, the same infra blindness would silently downgrade you to Devin-only without flagging it.

## Fix (pipeline)
harvest-reviews.py should distinguish "review check-run FAILED on the pinned head" from "no review attempted", and return exit **21** (infra gap) — not 20 — when the production review ran and failed. The approver should then record `NO_REVIEW_SIGNAL` (infra) if Devin also fails, or decide from Devin while explicitly logging the primary-review infra failure. Separately, the production `claude-pr-review.yml` pre-stage should fetch the diff via the Files API / local clone (as the 406 message itself advises) instead of the `.diff` media type, so large PRs get reviewed at all.
