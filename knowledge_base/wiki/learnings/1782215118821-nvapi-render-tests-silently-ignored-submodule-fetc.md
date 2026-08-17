---
title: "NVAPI render-tests silently 'ignored' — submodule→FetchContent migration left render-test path stale"
type: learning
topic: misc
source: learnings/1782215118821-nvapi-render-tests-silently-ignored-submodule-fetc.md
---

# NVAPI render-tests silently "ignored" — submodule→FetchContent migration left render-test path stale

**Context:** Triaging shader-slang/slang#10660 "NVAPI tests are silently ignored" (2026-06-23, HEAD a39e49c28).

**Durable mechanism (reusable):** When a render-test's runtime prerequisite is missing, `_setSessionPrelude` in `tools/render-test/render-test-main.cpp` returns `SLANG_E_NOT_AVAILABLE`; `_innerMain` propagates it and **slang-test reports the test as "ignored", not failed** — so CI stays green while coverage is silently lost. This is the general "missing-prereq = skip" pattern (see also learnings 1781222721953 / 1780769170873). When someone says "tests are silently ignored," look for a prereq-resolution failure returning a not-available code, not a test-logic bug.

**Specific cause:** NVAPI was **removed from `.gitmodules`** (no longer a submodule). It is now FetchContent-fetched by the slang-rhi submodule (`external/slang-rhi/CMakeLists.txt` `FetchPackage(nvapi ...)` → `build/_deps/nvapi-src/`). But two slang-side consumers were never updated: render-test still hard-codes the source-tree path `external/nvapi/nvHLSLExtns.h` (`render-test-main.cpp:~1591`), and `cmake/FindNVAPI.cmake` still searches `${slang-SOURCE_DIR}/external/nvapi`. Both are stale → the `-nvapi-slot` / `hlsl_nvapi` render-tests get ignored.

**CI wrinkle:** slang CI builds and tests on **different machines**; only the build artifact travels. So `build/_deps/...` isn't reachable at test time — the headers must be copied into the uploaded test artifact. The correct fix shape (see draft PR #10865) keeps the runtime path as `external/nvapi/...` by copying headers to `build/$<CONFIG>/external/nvapi/` and packaging that dir into the artifact.

**Triage takeaway:** Before dispatching a fixer, `gh pr list --search "<topic>"` for an in-flight maintainer PR. #10660 was self-assigned to the author who already had a (stale, unlinked) draft PR #10865 — parked the fix-forward rather than double-working it. Maintainer draft PRs are often NOT linked to their issue (no `Closes #N`), so the issue page doesn't surface them — worth linking in the triage comment.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215118821-nvapi-render-tests-silently-ignored-submodule-fetc.md`_
