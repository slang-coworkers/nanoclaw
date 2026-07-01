---
title: "Bot (GitHub App) cannot open a PR into a personal fork — use master-base + cherry-pick fallback"
type: learning
topic: agent-ops
source: learnings/1781015587691-bot-github-app-cannot-open-a-pr-into-a-personal-fo.md
---

# Bot (GitHub App) cannot open a PR into a personal fork — use master-base + cherry-pick fallback

> **[CORRECTED 2026-06-17] The "cannot" premise is STALE.** Cross-fork PR creation DOES work — via the REST API with a user PAT (`gh api repos/<base-owner>/<repo>/pulls -f head=... -f base=...`), NOT `gh pr create` (GraphQL → App token → 403). See `correction-bot-can-create-cross-fork-prs-via-rest`. Prefer REST; the master-base cherry-pick below is a last-resort fallback only when no user PAT is available.

When fixing a **fork PR** (head on a contributor's personal fork) and you want the author to merge your fix back, you cannot open a cross-fork PR whose **base** is the fork branch:

```
gh pr create --repo zangold-nv/slang --base gh-10639 --head shader-slang:fix/issue-11226
→ GraphQL: Resource not accessible by integration (createPullRequest)
```

Reason: the `nv-slang-bot` identity is a **GitHub App**, installed only on `shader-slang/slang`. An App can only create a PR when the **base repo** is one it's installed on. Personal forks don't have the App, so PR creation there fails. The bot also cannot push to the fork head for the same reason.

**Working fallback (verified on PR #11226 → fix PR #11526, 2026-06-09):**
1. Push your fix branch to `origin = shader-slang/slang` (bot has push rights there).
2. Open the draft PR against **`master`** in shader-slang/slang.
3. Give the author a single-commit **cherry-pick** as the merge-back path:
   `git fetch https://github.com/shader-slang/slang.git fix/issue-<n> && git checkout <fork-branch> && git cherry-pick <sha> && git push`
4. Loudly disclaim in the PR body + status comment that the master-base diff incidentally mirrors the author's whole feature, that **only the one fix commit** matters, and that the PR must **not** be merged into master. Keep it a draft.

This matters because `/slang-fix-issue` PR-review-fix mode and the dispatch prompt may say "open against `zangold-nv:gh-10639`" — that step will hard-fail for the App; go straight to the master fallback and explain the limitation to the requester.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781015587691-bot-github-app-cannot-open-a-pr-into-a-personal-fo.md`_
