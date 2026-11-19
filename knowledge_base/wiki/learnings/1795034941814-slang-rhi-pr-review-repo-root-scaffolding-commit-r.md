---
title: "slang-rhi PR review: REPO_ROOT scaffolding-commit recipe and verify-build flags"
type: learning
topic: ci-tooling
source: learnings/1795034941814-slang-rhi-pr-review-repo-root-scaffolding-commit-r.md
---

# slang-rhi PR review: REPO_ROOT scaffolding-commit recipe and verify-build flags

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795032773987-jgl6gp
written_at: 2026-11-18T20:49:01.814Z
---

# slang-rhi PR review: REPO_ROOT scaffolding-commit recipe and verify-build flags

Reviewing a **slang-rhi** PR with the slang-pr-review-runner (pr mode), recipe proven on shader-slang/slang-rhi#977 (2026-11-18):

1. **REPO_ROOT must be a slang-rhi tree at the PR base**, not the slang checkout — the inner reviewers read "surrounding code context" from REPO_ROOT and would otherwise explore the wrong repo. Both runners require `REVIEW.md` (and C requires the `slang-review-*` skills) **committed** at origin/master, because Reviewer C creates a fresh `git worktree add` from REPO_ROOT and untracked copies don't survive it. Recipe: detached worktree of the local slang-rhi clone at the base sha → copy `REVIEW.md`, `.claude/agents/*.md`, `.claude/skills/slang-review-*` from the slang checkout → one "review scaffolding" commit → `git clone --bare --shared` it to `bare-<pr>.git` → `update-ref refs/heads/master <scaffold-sha>` + `symbolic-ref HEAD refs/heads/master` (**must be named master**: slang-rhi's default branch is main but the runners fetch/checkout `origin/master`) → clone `wt-<pr>-revA/revC` from the bare. The diff still comes fresh from `gh pr diff`, so diff-integrity is unaffected; context.json's base_sha just records the scaffold sha and nothing compares it.
2. **slang-rhi verify build flags**: `cmake --preset default -DSLANG_RHI_BUILD_TESTS_WITH_GLFW=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF` on this Linux container — GLFW's configure dies on missing Xinerama headers, and either the tests-with-glfw option OR examples pulls GLFW in. Never `install_packages` mid-review (container rebuild kills detached reviewers).
3. **CPU-backend headless test pattern validated**: the new plain doctest TEST_CASEs (guarded `#if SLANG_RHI_ENABLE_CPU`, no GPU needed) run on Linux; revert drill — `git checkout <base> -- src/cpu/*.cpp`, rebuild, rerun — cleanly demonstrated the tests fail on base (3 pass / 2 fail, 21 assertion failures) and pass on head (5/5, 56/56). Filter `-tc='*cpu-texture*'`: 5 matched + 1091 skipped = registered, not vacuous.
4. **Devin bug-card caveat**: on a fix PR, Devin can list a bug whose title is the issue symptom the PR fixes ("Wrong faces in singleton cube arrays") while its own AI Analysis describes the fix approvingly — always adjudicate a Devin bug card against the current head with a live run before counting it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795034941814-slang-rhi-pr-review-repo-root-scaffolding-commit-r.md`_
