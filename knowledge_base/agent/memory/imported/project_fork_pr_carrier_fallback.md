---
name: Fork-PR fix delivery — carrier PR fallback
description: nv-slang-bot App can't push/PR into personal forks; pr-review-fix on a fork PR must use a master-base carrier PR + cherry-pick merge-back
type: project
originSessionId: 97700597-c3e6-4755-95f3-2c655f2131aa
---
When a `pr-review-fix` targets a **fork PR** (head repo is a personal fork, `fork: true`), the bot cannot deliver the fix into the author's branch directly.

**Why:** `nv-slang-bot` is a GitHub App not installed on personal forks → `Resource not accessible by integration`. It can neither push to the fork head branch nor open a PR with the fork branch as base.

**How to apply:** On dispatch, set expectations up front — the fixer will fall back to a **carrier PR against `master`** (kept draft, label `pr: non-breaking`) whose merge-back path is a single-commit cherry-pick (`git fetch …<fixbranch> && git cherry-pick <sha>`) spelled out in both the carrier PR body and the status comment on the original PR. The carrier PR's diff-vs-master incidentally mirrors the author's feature work and **must never be merged into master** — it exists only to carry the fix commit. First confirmed on PR #11226 → carrier #11526 (2026-06-09).

**UPDATE 2026-06-16/17:** Operator provisioned an `nv-slang-bot` **user PAT**. The bot CAN now open a true cross-fork PR (`slang-coworkers:fix/issue-<n>` → base `<fork-owner>:<their-branch>`) the author merges into their own PR — carrier+cherry-pick no longer the only option.

**CRITICAL — REST, not GraphQL.** Cross-fork PR creation MUST go through REST: `gh api -X POST repos/<fork-owner>/<repo>/pulls -f title=… -f head='slang-coworkers:fix/issue-<n>' -f base='<their-branch>' -f body=… -F draft=true`. Do NOT use `gh pr create` — it routes through the GraphQL `createPullRequest` mutation, and `/graphql` is intentionally injected with the **App** token (shared with Projects), so it 403s `Resource not accessible by integration` no matter what. REST `POST …/pulls` gets the **user PAT** → 200 (PR opens as type User `nv-slang-bot`). Operator-verified live 2026-06-17. This is the SAME REST-not-GraphQL split as bot self-merge (see feedback_nv_coworkers_automerge) — `gh api .../pulls` works, `gh pr create/merge` 403.
- A `gh pr create` 403 is therefore NOT proof the PAT is missing — wrong test. `gh api user` 403 only tells you the *default* token is the App; REST write paths can still carry the PAT.
- **Rebase first:** the slang-coworkers fork branch drifts behind the contributor's `gh-10639`; rebase onto `<fork-owner>:<their-branch>` and force-push to the slang-coworkers fork (own fork — safe) before opening the PR.
- Keep it draft per the drafts-only guardrail; the contributor marks ready + merges. Not operator-gated (only `gh pr ready`/`gh pr merge` are).
