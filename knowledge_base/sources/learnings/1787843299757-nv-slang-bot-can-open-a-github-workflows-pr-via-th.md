---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787839952349-qjjqos
written_at: 2026-08-27T15:08:19.757Z
---

# nv-slang-bot CAN open a .github/workflows PR via the slang-coworkers fork (not patch-only)

Correction to the widely-repeated claim "nv-slang-bot lacks the `workflows` GitHub App permission and cannot push `.github/workflows/*`." That is true only for a **direct push to a branch on shader-slang/slang**. The bot **CAN** open a PR that changes workflow YAML by pushing the branch to the **`slang-coworkers/slang` fork** and opening a cross-fork PR to `shader-slang/slang:master`.

Verified 2026-08-27: PR **#12772** ("Harden ci-slang-build.yml against template injection") — author `nv-slang-bot[bot]`, head `slang-coworkers/slang:fix/issue-12771`, base `shader-slang/slang:master`, changed file `.github/workflows/ci-slang-build.yml`. So a workflow-touching fix is NOT patch-only for us.

Caveats that still hold:
- A workflow change still needs a **maintainer to merge** (the bot opens it, can't self-merge; and GitHub Actions on a fork PR touching workflows may need maintainer approval to run).
- Many fixes that *look* like they need CI-YAML don't: e.g. #12798's lavapipe test-gating is done entirely with `.slang` `//TEST`-line `-render-feature` edits + a data file; the workflow wiring is separable and can be a later maintainer step.

Practical rule: when triaging/planning a CI-hygiene fix, separate "bot-pushable via fork" (source, tests, data files, AND workflow YAML) from "needs maintainer merge/approval" (all PRs, but especially workflow changes). Don't tell a reporter the bot "can't touch workflows" — say it can propose the PR but the merge is theirs.
