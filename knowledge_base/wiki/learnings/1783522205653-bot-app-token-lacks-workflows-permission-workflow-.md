---
title: "Bot App token lacks 'workflows' permission → workflow-file PRs must go cross-fork via slang-coworkers"
type: learning
topic: slang-compiler
source: learnings/1783522205653-bot-app-token-lacks-workflows-permission-workflow-.md
---

# Bot App token lacks 'workflows' permission → workflow-file PRs must go cross-fork via slang-coworkers

**Context:** slang-fixer implementing #11989 (H-A CI gate) needed to change `.github/workflows/ci-examples.sh` and `.github/workflows/ci-slang-test.yml` on shader-slang/slang. Reported + verified during triage roll-up.

**Problem:** The nv-slang-bot GitHub **App token lacks the `workflows` permission** on shader-slang/slang. Any push to an origin (shader-slang) branch that MODIFIES a file under `.github/workflows/` is **remote-rejected** ("refusing to allow a GitHub App to create or update workflow ... without `workflows` permission"). This blocks the normal same-repo branch → draft PR flow whenever the diff touches a workflow file.

**Working route (what the fixer did for PR #12001):**
1. Push the branch to the **slang-coworkers fork** (the bot can push workflow files there), not to a shader-slang branch.
2. Open a **cross-fork draft PR** into `shader-slang/slang:master` via the **REST API** (`gh api repos/shader-slang/slang/pulls -f head=slang-coworkers:<branch> -f base=master ...`). NOTE: `gh pr create` (GraphQL) FAILS here with "fork collaborator can't be granted" — use REST, not the GraphQL-backed `gh pr create`.
3. `report_pr_created({repo:"shader-slang/slang", pr_number})` still works for webhook routing.

**Consequences to flag to the maintainer in the roll-up:**
- **No `ci.yml` run on the draft.** A cross-fork PR that is ALSO a draft gets no CI: drafts skip the `pull_request` CI path, and cross-fork blocks `workflow_dispatch` (upstream 422 / fork 404). CI only fires when a maintainer flips it to **ready**. So a green-less draft is expected — say so, or the maintainer will think CI is broken.
- The PR shows `isCrossRepository: true`, `headRepositoryOwner: slang-coworkers`. That's normal for this class of change, not a mistake.

**Also (separate false-negative, same session):** `gh auth status` shows RED ("token invalid") for the bot App token, but repo-scoped `gh api` / `gh pr view` calls WORK. The auth-status red is a known App-token false-negative — don't treat it as "not logged in." (Distinct from the transient model-access 403 "AWS Marketplace subscription still processing, retry in 15 min", which IS a real outage.)

**How to apply:** any Slang PR whose diff includes a file under `.github/workflows/` — plan for the cross-fork + REST route from the start, and warn the maintainer the draft won't have CI until ready-flip.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783522205653-bot-app-token-lacks-workflows-permission-workflow-.md`_
