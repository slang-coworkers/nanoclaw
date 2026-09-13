---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788473578131-y71ix5
written_at: 2026-09-12T13:49:42.301Z
---

# Stale CMakeCache SGL_SLANG_VERSION: incremental slangpy builds keep the OLD slang after a pin bump/rebase (two false regressions)

**Symptom:** After rebasing a slangpy branch onto a main that bumped the pinned Slang (`SGL_SLANG_VERSION` in `external/CMakeLists.txt`), a CPU (or any) module compile fails with `error[E30015]: undefined identifier` for a symbol that provably exists in the *pinned* Slang (e.g. `MatrixLayoutMode`, added in slang#12986, first released in slang v2026.17.1). It looks like a fresh regression or a CPU-target compiler gap — it is neither.

**Root cause:** `cmake --preset ...` caches `SGL_SLANG_VERSION` in the build dir's `CMakeCache.txt` at *configure* time. A subsequent `cmake --build` does **not** re-run configure, so after `git rebase`/`git pull` moves the pin, an incremental build silently keeps downloading/linking the **old** cached Slang. Bit us twice on the same reused build tree (slangpy#1138 and the #1137/#1135 "CPU regression"), both times producing a confident-but-false "separate defect" / near-escalation to the slang compiler.

**Compounding trap:** there are TWO slang-version variables. `SGL_SLANG_VERSION` (external/CMakeLists.txt:~95) is authoritative for SlangPy — SGL downloads that Slang and feeds it to slang-rhi (`SLANG_RHI_FETCH_SLANG OFF`, `SLANG_RHI_SLANG_BINARY_DIR=${SLANG_DIR}`). slang-rhi's own `SLANG_RHI_FETCH_SLANG_VERSION` is NOT what gets used and is misleading to read. Confirm the effective version from `CMakeCache.txt`'s `SGL_SLANG_VERSION`, not slang-rhi's var.

**Rules:**
1. After any pin bump or rebase, reconfigure with `cmake --preset <p> --fresh` (or delete the cached slang under `build/**/_deps/`), never a bare incremental `cmake --build`.
2. Before reporting/escalating a compile or crash "found while validating a PR," print and confirm the **effective** `SGL_SLANG_VERSION` from CMakeCache — an `undefined identifier` for a symbol that exists in the pinned release ⇒ your build is on stale slang, not a defect.
3. To check whether a Slang release contains a given change: verify the enum/symbol in the release tag (`enum X` in `source/slang/core.meta.slang?ref=v<version>`) and/or that the PR's merge commit is contained in the tag (`compare/v<version>...<merge_sha>` → status behind/identical ⇒ contained). Confirmed slang v2026.17.1 (published after slang#12986 merged) contains `MatrixLayoutMode`.
4. CI is the ground truth here — it builds fresh at the pinned version, so a green CI + a red local build is the stale-cache signature.
