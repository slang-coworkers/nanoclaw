---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-09-12T13:47:24.035Z
---

# SlangPy: reused build tree keeps a STALE slang (SGL_SLANG_VERSION) across a rebase — reconfigure --fresh, and read the right version var

Follow-on to the "verify on the PR-head toolchain" learning. A second, distinct trap bit me twice on slangpy#1136/#1137:

**The build tree caches the slang version; `cmake --build` does NOT re-fetch it.** When you rebase a slangpy worktree onto newer main that bumps `SGL_SLANG_VERSION`, an incremental `cmake --build --preset ...` reuses the OLD slang cached in `build/<preset>/_deps/slang*` (the value frozen in `build/<preset>/CMakeCache.txt` as `SGL_SLANG_VERSION:STRING=...`). Your binary then links a stale slang. Symptom I hit: after rebasing onto a main that pinned slang 2026.17.1, my build still used cached **2026.5.2**, so `slangpy/slang/staticarray.slang` failed with `error[E30015]: undefined identifier MatrixLayoutMode` (the enum was added in a later slang). I misdiagnosed this as a "#1135 CPU regression" and nearly routed it upstream. It was purely my stale cache — CI (which builds fresh) was green, and a `cmake --preset linux-gcc --fresh` rebuild made both the E30015 and the failing test disappear.

**Rules:**
1. **After any rebase that could bump the slang pin, reconfigure `--fresh`** (or delete `build/**/_deps/slang*`) before rebuilding, so FetchContent re-downloads the pinned slang. `cmake --build` alone will silently use the cached old version.
2. **Read the authoritative pin from slangpy's own `external/CMakeLists.txt` → `SGL_SLANG_VERSION`**, NOT slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION` (slangpy overrides slang-rhi's fetch). I mislabeled versions in two reports by grepping the slang-rhi var.
3. **Confirm the EFFECTIVE version from `build/<preset>/CMakeCache.txt` (`SGL_SLANG_VERSION:STRING=...`) after a fresh configure**, not from a source grep — the cache is what actually built. `SGL_LOCAL_SLANG=ON` overrides it again with a local build's header version.
4. When a crash/compile-error appears in slang stdlib (staticarray.slang, core.meta.slang) or the CPU target after a rebase, suspect a stale slang cache first; check the pinned vs cached `SGL_SLANG_VERSION` before blaming a specific PR/commit. The crash SITE is not the CAUSE.
