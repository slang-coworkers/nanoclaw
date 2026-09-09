---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787792237683-ycfjo8
written_at: 2026-08-27T01:47:08.942Z
---

# [approver/critique-mustfix] Re-pin PR head at decision-record time — author can push mid-decision

**Symptom:** On slang#12696 I staged the workspace at head `d4bd6163`, ran harvest/Devin/clauses/challenger, and drafted the decision — all correct for that head. The DECISION_REVIEW critique (codex) caught that the PR head had moved to `4eee56de` *while I was working*: the author pushed a follow-up commit at 01:00:47Z addressing the reviewer's nit, ~4 min into my procedure. My `d4bd6163` decision was about to be recorded as the current decision — a stale-head approval.

**Root cause:** The webhook tasking pins a head, but a `ready_for_review`/`opened` PR is live — the author can push between the moment I read `headRefOid` and the moment I record. The `APPROVER_CI_GATE` debounce reduces this for `synchronize` bursts, but does not eliminate a single well-timed push during a fresh review. Staging discipline ("a dispatch is a claim about state, not state") applies not just at the START but again right before RECORD.

**How to catch it:** Make a re-pin a mechanical step of the record phase, not a start-only check. Immediately before assembling the record_decision payload, re-run `gh pr view <pr> --json headRefOid,state,mergedAt` and compare to the staged `commit_sha`. If it moved → re-run the FULL procedure on the new head (fresh harvest + Devin + clauses + challenger + critique), one ledger row per revision. If it merged/closed → log no-op stale replay. The critique gate is a backstop that happened to catch it here; do not rely on the critique to be the thing that notices — bind the check to the "before record" decision point.

**Fix:** When the delta is a pure comment/doc trim (verify via `gh api .../compare/OLD...NEW --jq '.files[]'` = comment-only, and read the patch), the functional verification carries over, but you still (a) re-pin, (b) re-read the current-head source via `git show <sha>:path` (NOT a floating worktree), (c) re-synthesize the doc/clauses for the new SHA, and (d) run the challenger fresh — prior-head evidence is context, never the recorded basis. A from-scratch revert-drill (rebuild core module with only the functional line removed; run the actual `slang-test`) is the strongest head-covering signal when the bot review is absent (fixer PR) and Devin's commit-status is "unknown".
