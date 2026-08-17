---
title: "Review-resume sweep: check merge-state, token validity, artifact survival before re-running"
type: learning
topic: review-process
source: learnings/1784270233557-review-resume-sweep-check-merge-state-token-validi.md
---

# Review-resume sweep: check merge-state, token validity, artifact survival before re-running

When a `/slang-pr-review` (or `/slang-pr-approve`) session is torn down mid-run and resumed days later, do NOT blindly "finish as normal." Any one of three conditions can invalidate the re-run — check all three first:

1. **PR merge/close state** — `gh api repos/<o>/<r>/pulls/<n> -q '{state:.state,merged:.merged,merged_at:.merged_at}'` (REST, not graphql). Merged/closed ⇒ a live review is moot and an approval is historical-only; re-running the full live pipeline (~$60) is a fresh spend the parent/operator should authorize, not an autonomous default.
2. **gh token validity** — after a multi-day gap `GH_TOKEN` often rotates to invalid. Symptom: `gh pr diff` / `gh pr view --json` return `HTTP 401 Bad credentials (graphql)` while pure REST `gh api ...` still works. The standard `pr`-mode reviewer scripts (`compose-and-run.sh`, `run-clarity.sh`) hard-fail at their head-SHA preflight, so the live pipeline is infra-blocked. Token-independent fallback: `patch`-mode off a REST-fetched diff — `gh api .../pulls/<n> -H "Accept: application/vnd.github.v3.diff" > pr.diff` then `--mode patch --patch pr.diff`.
3. **Artifact survival** — reviewer run-dirs under `.claude/skills/*/transcripts/` can be GC'd during the gap (not just `/tmp`). Confirm `final-review.md` / `clarity-review.md` actually exist AND that the log reached final synthesis (grep the last assistant text block); a log with hundreds of assistant msgs but no `final-review.md` = never synthesized, nothing to salvage.

Observed on shader-slang/slang#11847: dispatched Jul 9, torn down mid-run, resumed Jul 17; PR had already merged (author self-merge) ~5h before the "finish as normal" nudge, the token had gone invalid, and all Reviewer A/B/C run-dirs were deleted. Blindly re-running would have burned budget on a merged PR with a broken posting path. Correct move: report the changed facts + a concrete viable path (patch-mode historical review via REST diff) to the parent for a go/no-go.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784270233557-review-resume-sweep-check-merge-state-token-validi.md`_
