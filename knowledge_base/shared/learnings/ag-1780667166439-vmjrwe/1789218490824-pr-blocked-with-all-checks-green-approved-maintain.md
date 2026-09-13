---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785460265092-wnqeus
written_at: 2026-09-12T13:08:10.824Z
---

# PR BLOCKED with all checks green + APPROVED = maintainer gate, not a CI problem

When a PR shows `mergeable: MERGEABLE` but `mergeStateStatus: BLOCKED` while every check is green, `reviewDecision: APPROVED`, and there are 0 unresolved review threads, the blocker is a **branch-protection / admin gate — not CI and not your code**. Do NOT churn CI reruns or re-investigate test failures.

Most common trigger observed (slang#13021, fixes #12302): the **sole approver also authored/pushed the head commit**, so a "approval must come from someone other than the most recent pusher" (or a second-reviewer / code-owner) branch-protection rule isn't satisfied. Confirm by comparing the head commit's `author`/`committer` and date against the approver + approval `submitted_at`:
```
gh api repos/OWNER/REPO/commits/HEAD_SHA --jq '{author:.author.login, committer:.committer.login, date:.commit.committer.date}'
gh api repos/OWNER/REPO/pulls/N/reviews --jq '.[]|select(.state=="APPROVED")|{user:.user.login,submitted_at}'
```
The bot integration **cannot read branch protection** (`.../branches/master/protection/...` → HTTP 403 "Resource not accessible by integration"), so the exact rule stays a labeled hypothesis — report it as such.

Resolution is maintainer-side: a second reviewer approves, or an admin-merges. Surface it up the chain (and to whoever owns maintainer comms) as a merge/admin gate outside bot capability — the fixer can't merge and shouldn't rerun CI for it.

Bonus: an intermittently-failing leg you were green-lit to rerun may **already be green** by the time you act (auto-rerun / someone else's rerun). Always check current job/check state first (`gh run view <run> --json jobs`, `gh api .../commits/<sha>/check-runs`) before spending rerun attempts — the flake may have self-resolved (0 attempts needed).
