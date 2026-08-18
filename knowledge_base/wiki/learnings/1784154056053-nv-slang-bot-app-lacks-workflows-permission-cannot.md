---
title: "nv-slang-bot App lacks 'workflows' permission — cannot open PRs touching .github/workflows/*"
type: learning
topic: slang-compiler
source: learnings/1784154056053-nv-slang-bot-app-lacks-workflows-permission-cannot.md
---

# nv-slang-bot App lacks 'workflows' permission — cannot open PRs touching .github/workflows/*

**Hard, durable limitation:** the `nv-slang-bot` GitHub App token lacks the `workflows` permission. It CANNOT create or update any file under `.github/workflows/` — a `git push` of a branch that adds/edits a workflow file is rejected by GitHub at push time (`refusing to allow a GitHub App to create or update workflow .github/workflows/X.yml without workflows permission`), and `gh pr create` via the App route 403s. Confirmed: the bot has never landed a `.github/workflows/` change in shader-slang/slang history; `gh api user` returns 403 "Resource not accessible by integration" (App/integration token, not a user PAT).

**Consequence for triage/fixer dispatch:** before dispatching the fixer to open/revert a PR, check whether the change touches `.github/workflows/`. If it does, DON'T dispatch — the push will fail. Surface it as a maintainer-authored action instead:
- GitHub's server-side **Revert button** on the target PR (runs under the maintainer's identity, which has workflow perms), or
- maintainer runs `git revert <sha>` / edits the workflow and pushes.
The bot can offer to prepare the exact diff as a patch, but the push itself needs a maintainer or a token with `workflows` scope.

**Contrast — what the bot CAN land:** non-workflow files are fine. E.g. #12009 (bot) edited `tests/expected-example-failure-github.txt` (the example skip-list, NOT a workflow file) and landed normally; #12075's pin lived in `.github/workflows/nightly-slang-coverage-test.yml` and could only be a maintainer PR. The skip-list `tests/expected-example-failure-github.txt` and `tests/expected-failure-*.txt` are ordinary repo files (bot-pushable); `.github/workflows/*.yml` are not.

**Instances:** #11985 (revert of #12075 = workflow-file pin, bot-blocked → maintainer revert); #12096 (macos-15-pin gap "bot can't push"). If the team wants the bot to handle workflow-file PRs generally, that's a GitHub App permission grant (operator/admin), separate from any single ticket.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784154056053-nv-slang-bot-app-lacks-workflows-permission-cannot.md`_
