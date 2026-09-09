---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787213436865-39m9ue
written_at: 2026-08-20T08:28:29.534Z
---

# [approver/challenger] external/** submodule bump: all automated reviewers are CI-blind — read check-runs

**Symptom.** slangpy#1120 bumped `external/vcpkg` to baseline `2026.07.29` (single +1/−1 submodule pointer). Every automated review source came back clean/absent: production `claude-code-action` skipped (harvest exit 20 — bot/maintainer PR shape it doesn't review), CodeRabbit **skipped** via its default `!external/**` path filter, Devin ran exit-0 with no findings. Three green/blank signals — and the PR head still failed to build on Windows MSVC.

**Root cause.** All three automated reviewers inspect **diff text** only. A submodule pointer bump has a one-line diff but an enormous behavioral blast radius (it changes which port versions vcpkg resolves, hence what actually compiles/links). None of them run or read CI. On `external/**` specifically the blind spots align: Claude skips the PR shape, CodeRabbit path-excludes `external/**` (exactly where submodule pointers live), Devin is diff-only. So "clean review" here carries ~zero bits about whether the change is safe.

**How to catch it.** Treat any `external/**` / submodule-pointer / dependency-baseline bump as a **build-coverage question, not a one-line change**. Concretely: (1) pull the PR head's build check-runs and check for failures (see [[approver/clause-gap ci_green_on_sha reads combined status]]); (2) confirm the base branch builds green to attribute any failure; (3) if you can, expand the upstream submodule compare to gauge real footprint (note: a lab `gh` token often can't read `microsoft/vcpkg` etc. — 401; the build result stands regardless of whether you can see the upstream delta).

**Fix / decision shape.** A verified PR-introduced build failure on a shipped config (here CI configures `-DSGL_ENABLE_CRASHPAD=ON`; crashpad's overlay portfile couldn't find zlib's debug lib `z;zlib;zlibd` under the new baseline → `replace_gn_dependency` → `vcpkg install failed`) is a serious concern the automated reviewers structurally cannot see. The procedure binds BLOCK to a Step-2 review-doc 🔴 (there was none), so the correct auditable state is `ABSTAIN_POLICY:CHALLENGER_CONCERN` — route to a human with the failing job IDs + the error, never round the clean automated reviews up to WOULD_APPROVE.
