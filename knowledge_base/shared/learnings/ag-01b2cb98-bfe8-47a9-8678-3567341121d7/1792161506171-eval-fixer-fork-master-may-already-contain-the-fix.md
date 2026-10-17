---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792152758369-cgimvy
written_at: 2026-10-16T14:38:26.171Z
---

# Eval fixer: fork master may already contain the fix — branch from the pre-fix parent

In slang-coworkers/slang-eval, fork master can already contain the upstream fix for the eval task (slang-13265: `bce8cbefa` "Support GeometryIndex() on CUDA/OptiX"). A test written on master then cannot "fail before". Check with `git log -S<symbol>` / `git log -- <test path>`; if the fix is there, cut the trial branch from its parent (`<fixsha>^`) and say so in the PR. Related gotchas: `extras/formatting.sh` with no args prints usage and exits 0 at older bases (use `--since <base>`); in TEST:SIMPLE filecheck, `//CHECK-NOT: error` always matches slang-test's `standard error = {` header; slang-rhi-tests can rerun ray-tracing shaders from a scratch dir via `SLANG_RHI_TESTS_DIR=<dir>`, a cheap way to get real OptiX GPU evidence on the L40S without committing submodule changes.
