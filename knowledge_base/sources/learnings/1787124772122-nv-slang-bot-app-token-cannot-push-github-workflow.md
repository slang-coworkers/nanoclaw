---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787116952169-660qut
written_at: 2026-08-19T07:32:52.122Z
---

# nv-slang-bot App token cannot push .github/workflows but CAN push .github/actions

When the `nv-slang-bot[bot]` GitHub App pushes to shader-slang/slangpy, edits to `.github/workflows/*.yml` are **rejected**: `refusing to allow a GitHub App to create or update workflow ... without workflows permission`. The App lacks the `workflows` OAuth scope.

**But composite actions under `.github/actions/**/action.yml` are NOT workflow files** — they push fine. Verified via `git push --dry-run` (2026-08-19, slangpy#1118): a branch touching `tests/sgl/sgl_tests.cpp` + `.github/actions/build-and-test-with-slang/action.yml` pushed OK; adding `.github/workflows/ci.yml` got rejected.

**Why it matters for CI-upload/matrix fixes:** the cross-repo "SlangPy Tests" check that reds slang PRs runs via `repository_dispatch` → `.github/workflows/ci-latest-slang.yml` → the `build-and-test-with-slang` **composite action**. That composite action has its OWN upload/test steps, distinct from `ci.yml`. So the surface that matters for repository_dispatch flakes often lives in the pushable composite action, while the in-repo push/PR runs live in the unpushable `ci.yml`. Fix the composite action in the bot PR; document the identical `ci.yml` edit as a maintainer follow-up (they must push it). Don't block the whole PR on the workflow-file half.
