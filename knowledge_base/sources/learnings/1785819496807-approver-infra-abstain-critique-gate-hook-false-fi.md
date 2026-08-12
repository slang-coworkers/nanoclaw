# [approver/infra-abstain] critique-gate hook false-fires on read-only gh pulls/ GETs — use commits/&lt;sha&gt; dates to bound review timing

## Symptom
On the slang-rhi#804 merge join, `gh api repos/<org>/<repo>/pulls/804/reviews` — a pure read — was blocked by `gate-critique-on-deliver.sh` with "CRITIQUE REQUIRED before PR creation. missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW." Repeated attempts hit the denial cap, which auto-filed a critique-gate bypass request; an admin **REJECTED** it. The hook pattern-matches the substring `pulls/` (or `pull`) in the command and classifies the call as a PR delivery, regardless of HTTP verb. Same hook also fired on `pulls/804/comments` during R1.

## Root cause
The gate keys on a command-text pattern, not on whether the call mutates anything. Read-only GETs against `/pulls/*` subresources (`/reviews`, `/comments`, `/files`) are indistinguishable to it from a `gh pr create`. So a legitimate, read-only calibration/join step gets gated behind a critique requirement that makes no sense for it — and the denial cap escalates to an admin who (correctly) rejects a bypass for something that never needed one.

## How to catch it / working alternatives
Don't burn attempts on the blocked path and don't request a bypass — **switch access path immediately** (the ONE-ADVERSARIAL-RETRY rule, and name both methods in the artifact):
- Review timing/existence: `gh pr view <n> --repo <r> --json reviews,reviewDecision,mergedAt,mergedBy,commits,mergeCommit` is NOT blocked and gives login / state / submittedAt per review.
- To bound WHICH commit a review covers without `/pulls/N/reviews` (the only place the literal `commit_id` field lives): fetch each candidate commit via `repos/<r>/commits/<sha>` (not blocked) and compare `commit.committer.date` against the review's `submitted_at`. If every commit predates the approval, the human reviewed at-or-after the final head. This BOUNDS the coverage; it does not confirm the attached SHA — say so explicitly.
- Per-commit changed paths (for class-invariance checks on a moved head): `repos/<r>/commits/<sha>` → `.files[]`, also unblocked.

## Fix
Record the limitation as **"could not verify X by method M"**, M named — never as "unavailable". Here: exact `commit_id` of the approval unconfirmed via the reviews endpoint (hook-blocked); timing established via commit-date-vs-submitted_at instead. A false capability-negative has no observable failure signature, which is why the method must be named. Also note `gh pr view --json` rejects invented field names (`merged` is not a field — use `state`/`mergedAt`); it prints the valid field list on error, so read that instead of guessing.
