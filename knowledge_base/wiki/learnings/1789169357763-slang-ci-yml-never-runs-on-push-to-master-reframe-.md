---
title: "slang ci.yml never runs on push to master — reframe 'is master red' as merge_group re-test"
type: learning
topic: slang-compiler
source: learnings/1789169357763-slang-ci-yml-never-runs-on-push-to-master-reframe-.md
---

# slang ci.yml never runs on push to master — reframe "is master red" as merge_group re-test

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1789168508497-q6ts9e
written_at: 2026-09-11T23:29:17.763Z
---

# slang ci.yml never runs on push to master — reframe "is master red" as merge_group re-test

**Discovery (2026-09-11, CI-health verification for the spvdb `unique_id_` merge-queue flake):** shader-slang/slang's `.github/workflows/ci.yml` triggers only on `workflow_dispatch`, `merge_group`, and `pull_request` (branches: [master]) — **never on `push`**. So there is no "master's own CI run" to check the way most repos have. When asked "is master red / is this repo-wide," the correct check is: pull recent `merge_group` runs for that workflow (`gh api repos/<owner>/<repo>/actions/workflows/<id>/runs?event=merge_group`) and look at which job failed in each, since merge-group runs re-test master's tip (plus queued PRs ahead) before each merge. A push-triggered "master" run simply doesn't exist for this pipeline.

**Also useful:** to quickly confirm whether your `gh`/GH_TOKEN has write access before attempting `gh issue create` / `gh pr merge`, run `gh api repos/<owner>/<repo> --jq .permissions` — a GitHub-App installation token scoped read-only reports `{"admin":false,"maintain":false,"pull":false,"push":false,"triage":false}` even though repo-scoped GET calls (issues, PRs, check-runs, logs) work fine. `gh api user` / `gh auth status` on such a token report "Bad credentials"/403 even when repo reads succeed — don't take that as evidence you lack read access; test the actual repo-scoped call instead. Cross-repo API calls (e.g. fetching a file from a *different* repo like KhronosGroup/SPIRV-Tools with the same `gh`) also 401 with "Bad credentials" — the installation token is repo-scoped; use `WebFetch` on `raw.githubusercontent.com` for public files in other repos instead.

**Also:** `gh run view <id> --log-failed` truncates/limits to the job's UNKNOWN STEP dump and can be 10k+ lines; grep immediately for the actual signal (assertion text, `FAILED test:`, `Assertion failed`) rather than reading it. And `gh api repos/.../actions/runs/<id>/jobs` without `--paginate` only returns the first 30 jobs — a run with 50+ jobs can silently hide the actual failing job if you don't paginate, even though the run-level `conclusion` is "failure" (observed: run 34574220286 showed zero failed jobs in page 1, but `--paginate` revealed `test-windows-debug-cl-x86_64-gpu-rhi` failed).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789169357763-slang-ci-yml-never-runs-on-push-to-master-reframe-.md`_
