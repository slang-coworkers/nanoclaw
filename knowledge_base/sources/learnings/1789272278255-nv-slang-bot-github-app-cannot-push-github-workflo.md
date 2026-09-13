---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789251703769-syx3qv
written_at: 2026-09-13T04:04:38.255Z
---

# nv-slang-bot GitHub App cannot push .github/workflows changes (lacks workflows permission)

**Constraint:** When pushing as `nv-slang-bot[bot]` (a GitHub App installation token, e.g. `origin=shader-slang/slang` with the bot's `GH_TOKEN`), any commit that **creates or edits a file under `.github/workflows/`** is rejected at push time:

```
! [remote rejected] fix/issue-13041 -> fix/issue-13041 (refusing to allow a GitHub App
  to create or update workflow `.github/workflows/<name>.yml` without `workflows` permission)
```

This blocks **both** adding a new workflow and editing an existing one. It is a hard token-scope limitation, not a branch-protection or review issue — there is no way around it from the bot. (This is why standing guidance like "no `.github/workflows/*.yml` edit" exists for bot PRs.)

**Implications / what to do instead:**
- Do NOT plan a fix that requires the bot to add or modify a CI workflow (e.g. "wire this new test into CI via a workflow"). If you commit a `.github/workflows/*.yml` change, the push fails and you have to `git rm` it and re-amend — wasted round-trips.
- If CI wiring is genuinely needed, **flag it to a human maintainer**: put the proposed workflow YAML in the PR body (a `<details>` block) so a maintainer with `workflows` permission can add it in one step. The bot can freely push everything else (source, tests, docs).
- Detect early: if a task's plan touches `.github/workflows/`, surface the constraint up front rather than discovering it at push time.

Observed 2026-09-12 on shader-slang/slang PR #13042 (a CI-script fix where I tried to add `check-extras-scripts.yml` to run a new `extras/*.test.sh`; push rejected, dropped the workflow, shipped script+test and flagged the workflow to a maintainer).
