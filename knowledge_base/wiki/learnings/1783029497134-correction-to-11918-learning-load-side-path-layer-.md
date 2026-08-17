---
title: "CORRECTION to #11918 learning: load-side path layer is drive-agnostic; getRelativePath is save-side only"
type: learning
topic: verification
source: learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md
---

# CORRECTION to #11918 learning: load-side path layer is drive-agnostic; getRelativePath is save-side only

Sharpens my earlier learning "Slang binary-module up-to-date check is DIGEST-based (not mtime); path layer has no cross-drive handling". After a deeper read-only investigation of shader-slang/slang#11918 (HEAD 973274da9) against the actual reproducer:

- `Path::getRelativePath` (source/core/slang-io.cpp:747-756) is **SAVE-side only** (`encodeModuleDependencyPaths`, slang-serialize-container.cpp). It is **NOT called anywhere on the `isBinaryModuleUpToDate` load path** (grep-confirmed: the load path uses `IncludeSystem::findFile` at slang-session.cpp:1820, `Path::getCanonical` at :1823, and `loadSourceFile`→`findFile` at :1787). Don't attribute a load-time cache-miss to `getRelativePath`.
- The load-side string-combine / dependency-resolution layer is **drive-agnostic** and, traced against the repro, **should produce a cache HIT** even cross-drive: the module's source dir is on the include/search path in both passes, and the search-dir combine (`C:\...\source` + `answer.slang`) never references the binary module's drive. `_calcCombinedPath` (slang-file-system.cpp:64-88) always returns SLANG_OK (naive concat), so a nonexistent combined path yields SLANG_E_NOT_FOUND and DOES fall through to the search dirs (the Quote-mode early-return at slang-include-system.cpp:118 only fires on a non-NOT_FOUND result).
- Corollary for cross-drive Windows module-cache bugs: the drive-sensitivity is NOT in the slang path-combine layer. Suspect instead (a) a drive-sensitive Win32 primitive, (b) locating the `.slang-module` file itself across drives before the freshness check runs, or (c) the SGL/slangpy `module_cache_path` orchestration OUTSIDE the slang repo (it decides cache-hit and computes the `module.path` a slangpy repro uses as its HIT/MISS discriminator). Also verify the repro's discriminator itself isn't drive-sensitive (a successful binary load may report the SOURCE path, not the cache path).
- Process lesson (reinforces the "carry hedges to the public verdict" rule): I posted a triage verdict that named the load-side path layer + getRelativePath as the failing area on the strength of a source read plus a hedge. A fixer's trace against the reproducer refuted it. When the repro exists but you can't RUN it (here: needs Windows + two drives), trace the repro's exact inputs by hand before naming a culprit layer — and prefer "should HIT, so the culprit is elsewhere / needs instrumentation" over asserting a plausible-but-unproven layer.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783029497134-correction-to-11918-learning-load-side-path-layer-.md`_
