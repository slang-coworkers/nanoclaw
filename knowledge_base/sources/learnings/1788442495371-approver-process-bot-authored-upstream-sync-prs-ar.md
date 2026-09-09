---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788442109279-1t767b
written_at: 2026-09-03T13:34:55.371Z
---

# [approver/process] Bot-authored upstream-sync PRs are a dispositive clause-fail class — run Step-1 clauses before spending Devin

**Symptom:** A periodic automated upstream-sync PR (e.g. slang-coworkers/nanoclaw#1431 "Sync nv-slangpy with upstream/main", author `nv-slang-bot[bot]`, 7270 lines / 45 files) arrives as a reviewable-PR dispatch. Tempting to build the full review input (harvest + Devin) per the workflow's Step 1b before deciding.

**Root cause / key facts:** This PR class fails Step-1 eligibility on two independent, data-only clauses that no review signal can rescue:
- `author_trust` FAIL — a GitHub App bot (`nv-slang-bot[bot]`) has `author_association=NONE`; it is never in the trusted set (OWNER/MEMBER/COLLABORATOR). Any bot-opened PR fails this outright.
- `tier_eligible` FAIL — a full upstream sync is thousands of lines, ≫ the v0-shadow cap of 400 lines / 30 files.

Because Step 3 (challenger) "runs only if Steps 1–2 pass," a clause FAIL short-circuits straight to ABSTAIN_POLICY(`CLAUSE_FAIL:...`), a *policy* (working-as-intended) reason — non-critique-gated, early return. The review doc / Devin cannot change a clause-fail abstain, so building them is wasted budget.

Also confirmed on this PR: `collect-reviews.sh` exits **20** (writes `{"found": false}`) — production claude-code-action / CodeRabbit genuinely skip bot-authored branches. Exit 20 here is a legitimate skip, NOT NO_REVIEW_SIGNAL, and NOT a reason to abstain on infra grounds; the clause fails dominate. And `no_protected_paths` can PASS even on a big sync (the net base…head compare may touch no `.github/**` / `**/*.yml`), so don't assume a sync PR fails on protected paths — let the script decide.

**How to catch it / Fix:** For a dispatch whose title/author signals a bot-authored periodic sync (author is a `[bot]` app; title "Sync … with upstream/…"), run `eval-clauses.py` FIRST. If `author_trust` or `tier_eligible` FAIL (they will for this class), record ABSTAIN_POLICY(`CLAUSE_FAIL:<names>`) and STOP — skip harvest-Devin and the critique gate. Reason_code should list every hard fail (e.g. `CLAUSE_FAIL:author_trust,tier_eligible`) with the full clauses.json in the ledger's `clauses` field. This is the expected, correct outcome, not a gap.
