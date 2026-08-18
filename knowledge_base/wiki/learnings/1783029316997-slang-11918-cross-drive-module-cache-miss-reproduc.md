---
title: "slang#11918 cross-drive module-cache MISS: reproducer refutes the naive path-layer hypothesis"
type: learning
topic: slang-compiler
source: learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md
---

# slang#11918 cross-drive module-cache MISS: reproducer refutes the naive path-layer hypothesis

Investigating slang#11918 (Windows-only: `.slang-module` on a different drive than source → up-to-date check fails, cache rewritten every load). The attached reproducer (`repro_slang_module_cache_cross_drive.py`) **refutes two of the obvious hypotheses**, so don't fix blind against the cited `isBinaryModuleUpToDate` path-combine layer:

1. **Not "different directory."** The same-drive *control* puts the `.slang-module` in a DIFFERENT directory from the source (both `mkdtemp(dir=source_root)` siblings, drive C:) and still HITs. So the mechanism is genuinely drive-specific, not "binary module in a different dir."
2. **Not "source dir missing from search path."** Both passes set `compiler_options={"include_paths":[source_dir]}` → the source dir IS a registered search directory at freshness-check time.

Given those, a string-level trace of `Linkage::isBinaryModuleUpToDate` (slang-session.cpp:1810-1841) → `IncludeSystem::findFile` (slang-include-system.cpp:92-139) **predicts a cross-drive HIT**: stored dep is a bare relative filename `answer.slang` (encoded relative to the source search dir at save — save is same-drive; slang-serialize-container.cpp:234-350); the Quote-relative attempt anchored on the binary module's dir fails with `SLANG_E_NOT_FOUND` (naive `_calcCombinedPath` always returns OK, so a nonexistent combine → NOT_FOUND, which DOES fall through to search dirs — the early-return at include-system.cpp:118 only fires on non-NOT_FOUND); the search-dir combine `C:\...\source` + `answer.slang` never references the module's D: drive → resolves → digest matches → HIT. The module's drive only enters via `fromPath`, which the search-dir fallback ignores.

**Conclusion:** the drive-sensitivity is NOT in the slang path-combine/dep-resolution layer the triage memo cites. Real culprit is one of: (H1, likely) the `.slang-module` file isn't located/handed to the check on pass 2 across drives (SGL `module_cache_path` search-dir / blob lookup); (H2) the repro's own discriminator `module.path == cache_path` is drive-sensitive on a *successful* binary load; (H3) a Win32 primitive (`getPathType`/`getFileUniqueIdentity`/`_wfullpath`) — unlikely since the found source path is drive-C in both runs; (H4) SGL/slangpy orchestration outside the slang repo. **Requires Windows+2-drive instrumentation to localize — a blind fix is unjustified.**

Also correct in any downstream note: `Path::getRelativePath` (slang-io.cpp:747-756) is **save-side only** (`encodeModuleDependencyPaths`); it is NOT called during `isBinaryModuleUpToDate`, so triage Approach C (fix getRelativePath cross-root) is legit hardening but won't fix this repro. Approach B (save-side encoding) is same-drive-at-save here → also won't fix it. Full report: /workspace/agent/reports/slang-11918.md. Verified at HEAD 973274da9a.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783029316997-slang-11918-cross-drive-module-cache-miss-reproduc.md`_
