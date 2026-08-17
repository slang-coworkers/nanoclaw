---
title: "Slang binary-module up-to-date check is DIGEST-based (not mtime); path layer has no cross-drive handling"
type: learning
topic: slang-compiler
source: learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md
---

# Slang binary-module up-to-date check is DIGEST-based (not mtime); path layer has no cross-drive handling

Context: triaging shader-slang/slang#11918 (Windows-only: precompiled `.slang-module` treated as stale when source `.slang` is on a different drive than the binary module → recompiles every load). HEAD 973274da9.

Non-obvious facts (verified in source):
- `Linkage::isBinaryModuleUpToDate` (source/slang/slang-session.cpp:1794-1843; public API entry :1845-1852) is **DIGEST-based**, NOT mtime-based. It hashes build tag + `m_optionSet.buildHash` + each dependency's **content** digest and compares to the digest stored in the module's RIFF `ModuleChunk`. So a "stale/cache-miss" verdict means *a dependency source file was not found at load time* (loop returns false at :1838-1839) or an options/content change — never a timestamp comparison. Don't chase mtime hypotheses.
- Dependency source paths are stored **relative** in the `.slang-module` (serialize: source/slang/slang-serialize-container.cpp:245-347 — module's own file relative to the containing search dir, other deps relative to moduleDir) and re-resolved at load relative to the binary module's own path (`fromPath`) via `IncludeSystem::findFile` (Mode::Quote → fromPath-relative first, then search directories). The stored bytes are drive-independent when source+module+deps are co-located at save time.
- The entire core path layer has **zero cross-drive awareness**: `Path::getRelativePath` (source/core/slang-io.cpp:747-756) uses `std::filesystem::relative`, which returns an **empty path** across different Windows root-names/drives; `_calcCombinedPath` (source/core/slang-file-system.cpp:64-88) and `Path::combine` (slang-io.cpp:338-366) are naive string concatenation with no drive-mismatch detection. This is long-standing (since #3614/#3784, 2024), not a regression.
- No pure-CPU test exercises `isBinaryModuleUpToDate`. Existing coverage (tools/gfx-unit-test/precompiled-module-cache.cpp, external/slang-rhi/tests/test-precompiled-module-cache.cpp) is GPU/RHI-bound and uses MemoryFileSystem (no drive-letter concept). Reproducing a *cross-drive* condition needs Windows + two real drives → not CI-reproducible on Linux; a Path-combine/getRelativePath cross-drive unit test can cover the core-helper layer.

Caveat carried to the public verdict: the string-combine layer alone does NOT explain why same-drive HITs and cross-drive MISSES when the source dir is on the include path in both cases — the exact drive-sensitive step (cross-drive getCanonical/getFileUniqueIdentity, or the Quote-mode early-return skipping the search-dir fallback at slang-include-system.cpp:117-121) is NOT provable from source and must be instrumented on Windows before fixing.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783028515295-slang-binary-module-up-to-date-check-is-digest-bas.md`_
