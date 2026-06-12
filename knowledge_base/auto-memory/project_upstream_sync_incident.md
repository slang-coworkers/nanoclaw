---
name: NanoClaw upstream-sync incident (blocked on operator decision)
description: Daily nv-fork upstream sync broken since 2026-05-29; nanoclaw daily task PAUSED; canonical fix plan exists; awaiting operator all/hybrid/hold
type: project
originSessionId: 27432744-e609-49bd-99fa-7fb60e05c15d
---
NanoClaw's daily upstream-sync (fork branches `nv-main` + `nv-{coworkers,dashboard,slang,slangpy,nanoclaw}`) has failed every run since 2026-05-29. Two root causes, both understood:

1. **`nv-main`** — genuine merge conflict from upstream `claude-code 2.1.154` / `agent-sdk 0.3.154` bump + `/upload-trace` feature. Conflicted files grew over time; as of 2026-06-01 dry-run all 4 (`container/Dockerfile`, `container/agent-runner/{package.json,bun.lock,src/poll-loop.ts}`) resolve clean/union. Needs human-judgment merge (version pins).
2. **5 sibling branches** — merge clean but `git push` rejected non-fast-forward. Stranded `sync/upstream-nv-*` refs from 2026-05-29 sit on origin with NO open PR, because `gh pr create` fails cross-fork under the GitHub-App token (GraphQL `createPullRequest` not authorized; OneCLI path-secret only covers REST). Fix = `gh api -X POST repos/.../pulls`.

**Canonical fix plan** (nanoclaw's filesystem, not mine): `/workspace/agent/reports/upstream-sync-plan-2026-06-01.md`. Steps: (1) patch `sync-upstream.sh` — idempotency check for existing remote `sync/upstream-*` + `gh pr create`→`gh api` swap + idempotent retry; (2) force-with-lease current merges over the 5 stranded refs and open PRs via `gh api`; (3) hand-merge `nv-main`. **Re-validate SHAs at execution — upstream moves daily.**

Daily sync task **PAUSED** 2026-06-02: `task-1779172909119-21vq6g` (cron `0 3 * * *`), owned by nanoclaw's container. `resume_task` to re-enable.

nanoclaw recommends **`hybrid`** (operator hand-merges `nv-main`, nanoclaw does the script patch + 5-PR backfill under typecheck+test gate). Operator has been silent across 5 daily fires; the dashboard `ask_user_question` card timed out on day 0 and mobile push is unavailable (Remote Control inactive).

**Why:** this spans days and likely multiple of my own sessions; without a pointer a future-me would not know what `all`/`hybrid`/`hold` means when the operator finally answers.
**How to apply:** when the operator returns with a decision, dispatch to nanoclaw on the existing plan; if `hybrid`, hand `nv-main` merge to the operator and authorize nanoclaw for steps 1+2; resume the paused task once the script patch lands. Verify the plan doc + SHAs are still current first (upstream drifts).
