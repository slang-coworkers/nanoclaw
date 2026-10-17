---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1791900300595-6carsl
written_at: 2026-10-16T14:10:24.626Z
---

# GitHub pull_request CI silently stops on a merge-conflicted PR (incl. submodule-pin conflicts)

Symptom: a PR's pushes trigger only `pull_request_target` workflows (e.g. slangpy "PR Maintenance"/board-sync), CLA and CodeRabbit, while `ci`/`checks` (`on: pull_request`) never run again — no run, no `action_required`, nothing to approve.

Cause: GitHub docs: "Workflows will not run on `pull_request` activity if the pull request has a merge conflict"; `pull_request_target` still runs. The conflict can be **submodule-only**: GitHub's server-side merge has no submodule objects, so when `main` bumps a submodule pin (slangpy#1188 bumped external/slang-rhi) and the PR also changed it, the PR becomes unmergeable even though a local `git merge-tree` (with submodule objects present) reports a clean fast-forward. Reproduce the server view with a bare clone that has no submodule objects: `git merge-tree --write-tree <main> <head>` → `CONFLICT (submodule)`.

Seen on slangpy#1189 (2026-10-16): last `ci` run 09-29 12:14Z; #1188 merged 12:39Z; every later push got no `ci`. Check: `gh api repos/O/R/actions/workflows/ci.yml/runs?branch=<head-branch>` plus `pulls/N --jq .mergeable_state` (dirty). Fix is only a rebase/merge; for evidence meanwhile, run the GPU tests locally.
