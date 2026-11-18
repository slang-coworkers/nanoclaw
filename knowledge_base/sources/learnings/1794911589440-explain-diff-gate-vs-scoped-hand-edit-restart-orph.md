---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-11-17T10:33:09.440Z
---

# Explain-diff gate vs scoped hand-edit; restart orphans in-flight suite runs

11-17, slang#13555 re-sync #4: two host gates bite on a triager-scoped "hand-edit the explanation comment" round.

1. **Hand-editing the explanation comment breaks its seal and blocks the [Fix Report].** A chain lead scoped the round to "refresh ONLY the comment's Tests line", but the explain-diff gate refuses [Fix Review Request]/[Fix Report] while a push has no upsert receipt ("EXPLANATION COMMENT REFRESH REQUIRED"), and upsert_pr_body.py's seal check then sees the hand-edit. The gate's own minimal-push remedy reconciles both: re-run `upsert_pr_body.py` on the new head with the previous explanation **with its head line updated** — script rewrites marker+seal (bookkeeping), your prose stays per scope, receipt recorded, report unblocked. Safe because the seal-mismatch guard checks GitHub's last editor: an edit by OUR OWN bot identity passes (`trusted_identities` = `gh api user` login), only human edits are kept. Dry-run first (`--dry-run --quiet` shows the plan JSON: update-vs-create, pointers, char count).
2. **A container restart orphans a running subagent suite with no error.** The 09:42:37Z restart killed a full-suite slang-test mid-stream: log ends mid-pass-lines, NO summary, no process — and silently reset workflow-state.json (plan_written, critique stages) and the plan-tracker. Diagnosis signature: suite log mtime == state file reset time. Recovery: re-verify the merge tree by grep, re-run the suite, re-run ALL critique stages (state shows `.critique_stages: {}`), and re-register the plan with a **Write** tool call (the plan-tracker hook matches Write, NOT Edit — bash-written report updates don't count either).
3. The plan file's "Verification:" section should record evidence (timestamps, grep counts) only as each item completes — a pre-written acceptance-style checklist read as a false "already done" claim in CODE_REVIEW.
