---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788459650863-01ks0y
written_at: 2026-09-03T18:56:45.098Z
---

# SlangPy companion PR for a Slang breaking change: CI merge-order & ci-latest-slang checkout-mode gotcha

When a shader-slang/slang PR is a **breaking change** (e.g. #12840 retyping the builtin matrix layout param `int` → `MatrixLayoutMode`), it triggers a red **"SlangPy Tests"** check. Fixing it means a companion slangpy PR, but there is a genuine **circular cross-repo CI dependency** you must document, not just "make green":

- The "SlangPy Tests" status on the slang PR is posted by **slangpy's `.github/workflows/ci-latest-slang.yml`** (triggered via `repository_dispatch: slang-pr-test` from slang's `ci-slangpy-trigger-test.yml`). Its `build-pr` job checks out **slangpy's DEFAULT branch** (`actions/checkout@v6`, no ref) and builds it against the PR's Slang. ⇒ It only greens once the fix is merged to slangpy `main` — it does NOT build your PR branch.
- slangpy's **own** `ci.yml` builds against the **downloaded pinned release** `SGL_SLANG_VERSION` (`external/CMakeLists.txt`, e.g. `2026.16.1`). If the breaking symbol (`MatrixLayoutMode`) isn't in that release, your retyped PR **fails slangpy's own CI** → can't merge. Deadlock.
- **Break the cycle with ONE manual gate-override, in this order:** (1) validate locally via `-DSGL_LOCAL_SLANG=ON` against the slang PR; (2) merge the slang PR past its red "SlangPy Tests" (known coordinated break); (3) cut a Slang release containing it; (4) land the slangpy PR **with a `SGL_SLANG_VERSION` pin bump** to that release. Don't bump the pin to a not-yet-existent release — the CMake download 404s.

**ci-latest-slang checkout-mode gotcha** (`.github/actions/build-and-test-with-slang`):
- `branch` mode = `git clone shader-slang/slang && git checkout <slang-branch>` — CANNOT reach a fork-only PR branch. The `workflow_dispatch` input `slang_branch` uses this mode, so it fails for fork PRs.
- `pr` mode = `git fetch origin pull/<n>/head` — DOES resolve any PR (incl. fork PRs). Used by the auto `repository_dispatch` path.
- So the reliable pre-merge validation for your slangpy branch is a **local `SGL_LOCAL_SLANG` build** (fetch the slang PR via `pull/<n>/head`, build, point slangpy at it), not a workflow_dispatch.

The red CI on the companion PR is expected (`undefined identifier '<Enum>'` when compiling slangpy `.slang` against the old pinned Slang). Post a one-line "red as expected — see Merge order" comment so the shepherd isn't misled. Sites for the matrix-layout retype: `slangpy/slang/staticarray.slang` and `src/sgl/device/print.slang` (both `let L : int` → `let L : MatrixLayoutMode`). Example: slangpy PR #1135 ↔ slang #12840.
