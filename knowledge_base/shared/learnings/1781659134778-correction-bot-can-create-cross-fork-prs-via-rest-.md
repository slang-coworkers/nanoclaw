# CORRECTION: bot CAN create cross-fork PRs via REST POST (not gh pr create) — GraphQL-vs-REST token split

**Corrects the earlier learning** "Bot (GitHub App) cannot open a PR into a personal fork — use master-base + cherry-pick fallback." That conclusion was based on tests that all hit App-token-injected endpoints; it's incomplete.

**Root cause of the `Resource not accessible by integration` 403:**
- `gh pr create` routes through the **GraphQL** `createPullRequest` mutation. The `/graphql` endpoint is intentionally injected with the **App** token (shared with GitHub Projects) by the OneCLI routing, so it 403s **regardless** of whether a user PAT exists.
- `gh api user` (`GET /user`) is also App-pathed → 403. So neither `gh pr create` nor `gh api user` returning 403 proves "the PAT is dead" — they only prove those *paths* use the App token.

**What actually works (operator live-verified 2026-06-16, from inside a fixer container):** the `nv-slang-bot` user PAT wins on **REST `/repos/*` write paths**. Create the cross-fork PR via REST, NOT `gh pr create`:
```
gh api -X POST repos/<fork-owner>/slang/pulls \
  -f title='...' -f head='slang-coworkers:<branch>' -f base='<fork-branch>' -F draft=true
```
→ 200 OK, PR created as user `nv-slang-bot`. Same REST-not-GraphQL split as bot self-merge. Push your fix branch to `slang-coworkers/slang` first (force-push to your own fork is fine), then REST-POST the PR.

**Caveats:**
- This depends on the OneCLI routing repointing the PAT onto your CLI's token for `/repos/*`. Verify per session — in one session predating the routing fix, even REST `/repos/zangold-nv/.../pulls` POST still returned the App 403 while `gh api user` also 403'd; a container restart may be needed to pick up the routing.
- I did NOT personally exercise the successful REST path — the specific fix it was for went moot (contributor self-fixed first), so this rests on the operator's live test + the well-known App-vs-PAT GraphQL/REST behavior.

**Second lesson from the same task:** ALWAYS re-check the target branch with work-from-latest *immediately before* executing a queued/authorized fix delivery. This fix sat ~8 days between diagnosis and the authorized go-ahead; in that window the contributor self-fixed the exact compile error (responding to review-bot findings) and all CI went green. Rebasing the now-redundant fix would have conflicted or pushed an unsolicited divergent refactor into a passing branch. The premise of an authorized action can go stale — verify before the irreversible step.
