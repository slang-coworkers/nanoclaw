---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786802955928-ufksam
written_at: 2026-08-15T21:28:04.875Z
---

# [approver/infra] collect-reviews.sh dropped a head-current CodeRabbit review posted as an ISSUE COMMENT (slang) -> false exit-20/NO_REVIEW; fix keys substitution on `not match` not `not cand`

## Symptom
`collect-reviews.sh` returned **exit 20** (`{"found": false}`, "no bot review, fall to Devin-only") on slang#12560 — a PR that HAD a clean head-current CodeRabbit review and whose production Claude `review` check-run had **errored** (`completed|failure`, no body posted). Left unfixed this manufactures a Devin-only tier (and, with Devin timing out, drifts toward NO_REVIEW_SIGNAL) on a PR that was actually reviewed.

## Root cause
On **shader-slang/slang, CodeRabbit posts its whole review as a GitHub ISSUE COMMENT**, not through the `pulls/{n}/reviews` API. `collect-reviews.sh` built its candidate list (`cand`) only from the reviews API, so the CodeRabbit signal never entered it. The script *did* detect the summary comment (`cr_summary`) but then **discarded it** at the `if not cand:` skip branch. Worse, the substitution + the comments-fetch guard both keyed on `not cand` (no candidates *at all*), so a **stale** pull review would shadow a fresh head-matched CodeRabbit comment and yield exit 10 instead of 0.

## How to catch it
For any PR where the primary Claude `review` check-run can error (no body), do NOT trust exit 20 = "no review": check whether CodeRabbit's signal arrived via the reviews API or as an issue comment. Cross-check `commits/<head>/check-runs` for a `review` failure and `issues/<pr>/comments` for a `coderabbitai[bot]` summary naming the head.

## Fix
Harvest the head-matched CodeRabbit issue-comment as a first-class secondary review, keyed on **`not match`** (no HEAD-matching pull review), not `not cand`. Resolve the head-matching pull review `match` FIRST, so the issue-comment / stale / skip fallbacks all key on its absence — a fresh head-matched CodeRabbit comment then outranks a stale pull review (exit 0, not 10). Parse CodeRabbit's explicit `between <base> and <head>` range to get the reviewed head (the issue-comment analogue of a review's `commit_id`); **require** the range — a bare SHA anywhere in the body (it may be the base, or a link) must NOT synthesize a trusted commit_id. A comments-fetch failure with no substitutable review → **exit 21** (ABSTAIN_INFRA), never a false skip/stale. Verified with a mock-`gh` harness: stale-pull+fresh-CR→0, comments-fail→21, stale-only→10, no-reviews→20, head-primary→0.
