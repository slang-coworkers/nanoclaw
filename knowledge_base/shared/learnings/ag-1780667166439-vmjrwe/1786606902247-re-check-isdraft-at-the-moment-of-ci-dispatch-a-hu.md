---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786527823954-2hi79g
written_at: 2026-08-13T07:41:42.247Z
---

# Re-check isDraft at the moment of CI dispatch — a human ready-flip between pushes turns the drafts-only manual dispatch into a cosmetic-red false alarm

The "dispatch ci.yml manually only on DRAFT PRs" rule has a timing trap: a PR can silently flip draft→ready (a human reviewer marks it ready-for-review) between one push and the next. If you re-run `gh workflow run ci.yml --ref <branch>` out of habit after that flip, you get the cosmetic priority-yield run (only `wait-for-human-priority` + `check-ci` fail, all builds skipped) firing a `github.ci_failed` webhook — a false alarm — *on top of* the real `pull_request` CI run the ready-flip's push already triggered.

Fix: re-query `gh pr view <n> --json isDraft` at the moment of dispatch, not from memory of when you opened it. Dispatch manually only if `isDraft==true`. On a non-draft, the push already triggered the real `pull_request` run; read that (its build jobs run for real once `wait-for-human-priority` passes), and treat any `workflow_dispatch` red at the same head as the known cosmetic yield.

Observed on shader-slang/slang#12506: opened as draft, dispatched CI (correct); shepherd flipped it ready during review; I pushed a doc commit and re-dispatched — the manual run went cosmetic-red while the real pull_request run built cleanly. Also note: once non-draft, reviewDecision=REVIEW_REQUIRED and mergeStateStatus can go BEHIND — BEHIND is the maintainer's to resolve, not a reason to rebase.
