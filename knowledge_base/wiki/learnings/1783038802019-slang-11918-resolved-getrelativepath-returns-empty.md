---
title: "slang#11918 RESOLVED: getRelativePath returns empty across Windows volumes → empty serialized module dep (PR #11921)"
type: learning
topic: slang-compiler
source: learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md
---

# slang#11918 RESOLVED: getRelativePath returns empty across Windows volumes → empty serialized module dep (PR #11921)

Follow-up to my earlier #11918 learning ("reproducer refutes naive path-layer hypothesis"). The reporter (skallweitNV) then posted a public-Slang-API-only C++ repro that SETTLED the root cause as **save-side** — correcting my investigation's source-only inference (I had assumed the stored dep was the non-empty `answer.slang`; it is actually EMPTY).

Root cause chain (all source-confirmed at HEAD):
1. `Path::getRelativePath` (source/core/slang-io.cpp:747) wraps `std::filesystem::relative`, which returns an **EMPTY path** (no `ec` set) when the two inputs have different root names — distinct Windows drive letters (`C:\` vs `D:\`). This is the general footgun: a relative-path helper that silently yields "" cross-volume.
2. `encodeModuleDependencyPaths` (source/slang/slang-serialize-container.cpp:293-326) picks `linkageRoot` as the first search dir where `!hasRelativeElement(getRelativePath(dir, module))`. `hasRelativeElement("") == false` (empty splits to no elements → no `.`/`..`), so a **cross-volume search dir is spuriously accepted** as linkageRoot. The repro's search paths were `{cacheDir_D:, sourceDir_C:}` with the cross-volume cache dir FIRST.
3. The module's own dep is then encoded as `getRelativePath(linkageRoot=cacheDir_D:, module_C:)` = EMPTY → serialized with no guard.
4. On reload, `isBinaryModuleUpToDate` (slang-session.cpp:1810-1841) can't resolve an empty dep path → digest-based freshness check fails → recompile + cache rewrite every load = the cross-drive cache miss.

FIX (PR #11921, minimal producer-side, 2 files +33/−1): make `Path::getRelativePath` fall back to the original (absolute) `path` when `std::filesystem::relative` yields empty — `if (ec || result.empty())`. An empty, unresolvable dep can no longer be serialized; the resulting absolute dep resolves via `IncludeSystem::findFile`'s absolute-path branch (slang-include-system.cpp:101, which resolves an absolute path independent of the `from` dir). Same-drive case unchanged (still stores portable relative). DID NOT also patch the linkageRoot scan / add an encode-side guard — both become unreachable-with-empty once getRelativePath never returns empty; no test fails without them (repo's "name the failing test" rule).

Gotchas for the next person: (a) this is NOT reproducible/unit-testable on Linux — `std::filesystem::relative` only returns empty across drive-letter roots on Windows; the regression unit test's exact-value asserts must be `#if SLANG_WINDOWS_FAMILY`-gated, with only an unconditional non-empty assert running cross-platform. (b) `std::filesystem::relative(p,p)` returns "." not "" so the `result.empty()` branch doesn't steal the same-location case. (c) Draft bot PR + manual `gh workflow run ci.yml` = priority-yield (only `check-ci` fails, all builds SKIPPED) — benign; the real matrix runs at ready-for-review.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783038802019-slang-11918-resolved-getrelativepath-returns-empty.md`_
