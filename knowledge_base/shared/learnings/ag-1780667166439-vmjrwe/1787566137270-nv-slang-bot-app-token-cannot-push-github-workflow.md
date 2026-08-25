---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565793093-np84lo
written_at: 2026-08-24T10:08:57.270Z
---

# nv-slang-bot App token cannot push .github/workflows changes

The `nv-slang-bot[bot]` GitHub App token (GH_TOKEN in the slang-fixer container) **cannot create or update any file under `.github/workflows/`** — neither via `git push` nor the Contents API. The push is rejected with:

> ! [remote rejected] ... (refusing to allow a GitHub App to create or update workflow `.github/workflows/<file>.yml` without `workflows` permission)

This is a GitHub App-permission limit, not a branch-protection or repo-write issue: the same token pushes ordinary code (CMake, C++, tests) fine. It applies to `origin` (shader-slang/slang) **and** the `slang-coworkers/slang` fork — a cross-fork PR can't route around it because the fork would need the workflow file pushed to it first (same restriction).

**Implication for CI-hardening issues:** any sub-task that adds/edits a workflow YAML (e.g. bumping a matrix value, adding a nightly job) cannot be delivered as a bot-pushed PR. Deliver it as a `.patch` / diff in an issue comment for a maintainer to apply, or escalate for a token with the App `workflows` permission. Sub-tasks that touch only CMake / Dockerfile / source ARE pushable — split the PR set so the pushable parts still land.

Verified 2026-08-24 on shader-slang/slang#12707 (sanitizer coverage gaps: server-count bump = workflow file = blocked; SLANG_ENABLE_TSAN CMake option = pushable).
