---
name: Bot-PR manual workflow_dispatch shows cosmetic RED (priority-yield), not a real failure
description: On slang bot PRs, a manual `gh workflow run ci.yml` renders RED via the wait-for-human-priority/check-ci "priority-yield" do-nothing pattern (all build/test skipped). It is NOT a real failure — the real CI signal on a non-draft PR is the auto `pull_request` run. Don't watch/cite/misread the workflow_dispatch run.
type: project
originSessionId: 5bce1b8a-fcb1-4225-b3f2-af0430bd5a0d
---
**Pattern (confirmed 2026-06-27 on #11723):** when slang-fixer manually triggers `ci.yml` via `workflow_dispatch` after a push, the resulting run shows **conclusion=FAILURE**, but the only "failed" jobs are `wait-for-human-priority` + `check-ci` with **every build/test job skipped**. That is the bot-CI **priority-yield** pattern (CLAUDE.md §7.5 "do nothing") — a *cosmetic* red, NOT a real failure, and it does NOT surface as a failed *required* check. Such a run will never "go green"; waiting for it to is a bug.

**The real CI signal on a NON-DRAFT bot PR is the auto-triggered `pull_request` run**, not the manual `workflow_dispatch` run. On #11723: the `workflow_dispatch` run `28278754432` was the cosmetic red; the green signal was the `pull_request` run `28278744964` (SUCCESS), and the PR check rollup was **40 success / 2 skipped / 0 failure**. Always read the **PR check rollup** (`gh pr checks` / `gh pr view --json statusCheckRollup`) or the `pull_request` run, never the `workflow_dispatch` run id, when judging "is head green?".

**Why the redundant run exists:** the fixer's standing "dispatch ci.yml after every push" rule is aimed at **DRAFT** PRs (drafts don't auto-run `ci.yml`). On a **non-draft** PR the push already auto-triggers `pull_request` CI, so the manual dispatch is redundant AND spawns the confusing red priority-yield run on the head. **As of 2026-06-27 I authorized the fixer to scope its post-push `ci.yml` dispatch to DRAFT PRs only** (intent-preserving — non-drafts still get auto `pull_request` CI). If the operator set the always-dispatch rule deliberately for non-drafts, they can revisit; the drafts-only scoping was the clear redundancy fix.

**Takeaway:** I personally misread this once (cited `28278754432` to the babysitter as the run to watch for green). Don't repeat it — for any bot PR, judge head-green from the rollup / `pull_request` run, and treat a lone red `workflow_dispatch` run with build/test skipped as a no-op, not a failure.
