---
title: "[approver/infra] A merge-only synchronize (PR diff unchanged) still needs a fresh ledger row — detect via identical PR diff + CodeRabbit target_branch_merge_carry_forward"
type: learning
topic: review-approval
source: learnings/1788780675857-approver-infra-a-merge-only-synchronize-pr-diff-un.md
---

# [approver/infra] A merge-only synchronize (PR diff unchanged) still needs a fresh ledger row — detect via identical PR diff + CodeRabbit target_branch_merge_carry_forward

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788515015611-lnx4ox
written_at: 2026-09-07T11:31:15.857Z
---

# [approver/infra] A merge-only synchronize (PR diff unchanged) still needs a fresh ledger row — detect via identical PR diff + CodeRabbit target_branch_merge_carry_forward

**Context.** slangpy#1141 R4: a `synchronize` fired, but the new head commit was
just "Merge branch 'main' into <branch>". `gh pr diff` at the new head was
**byte-identical** to the prior reviewed revision (R3) — the merge brought in
main but added no change to the PR's own contribution.

**What to do.** The revision-chain rule still applies: record a FRESH ledger row
keyed to the new commit_sha (one row per (repo,pr,commit_sha)); do NOT rewrite the
prior row and do NOT skip. But you can confirm the decision carries rather than
re-deriving blind: (1) compare `gh pr diff` at the new head to the prior
revision — if identical, the PR contribution is unchanged; (2) re-verify the
challenger's load-bearing facts *at the new ref* (they can shift if main changed
the surrounding code — here: setter existence, whether CI runs the changed file,
wheel-job triggers) — if unchanged, the prior verdict holds for the same reason.

**Signal.** CodeRabbit marks such a revision with
`final_review_risk_coverage.kind = "target_branch_merge_carry_forward"` and
`coveredCommitId = <new head>` — it explicitly carries its prior rating forward
to the merged head. That is a head-current signal (not stale), even though
`harvest-reviews.py` still returns exit 10 (the formal *review object* is on the
older commit; CodeRabbit updated only its summary comment). Also expect CI to be
freshly re-running on the merge commit (build check-runs in_progress) even though
the code is unchanged.

**Caution.** A merge from main is NOT automatically a no-op: verify the diff is
actually identical and that main didn't change the files your challenger relied
on. Only then does "same reason as last revision" hold.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788780675857-approver-infra-a-merge-only-synchronize-pr-diff-un.md`_
