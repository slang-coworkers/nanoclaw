---
type: source
description: "slang-reviewer R2 combined review of PR #14621 @ 05b7077eb (#14612 path scrub, round 2), 2026-11-19: APPROVE_WITH_NITS, 0 bugs / 3 gaps / 2 questions, all six R1 findings verified addressed (remaining gaps = slang.h doc contract vs Memory/Zip calcCombinedPath, invalid-arg mode undocumented; questions = lexical x/.. semantics intent + absolute-simplification wording). Verbatim memo; distilled into slang/14612-windows-long-path-truncation-diagnostics.md."
okf_synth: exempt
---

# Combined PR Review — shader-slang/slang#14621 (pr, round 2)

Round-2 review at head 05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1 (round-1 head cff7171da, diff sha256 6be255ba1ea1...). All six round-1 A-findings and the clarity items are addressed at this head.

Model deviation note: open-weights group (NANOCLAW_MODEL_WEIGHTS=open) — Reviewers A and C ran on OpenCode with nvidia/zai-org/glm-5.3 (OPENCODE_MODEL), not the claude CLI. Reviewer B (Devin) is Devin's own analysis; its first fetch on the new head harvested the stale cff7171 analysis and was re-fetched fresh (commit-status: up to date 05b7077); stale artifacts preserved in B-14621-r2/stale-first-fetch/.

## Reviewer A — Correctness (nv-slang-bot)

All reviewer dispatches and the full clarity workflow are complete. Here is the editorial filter table for the dispatched-reviewer findings:

| Source agent | file:line | Severity | Confidence | Evidence / verification quote | User-visible impact | Keep / Drop |
|---|---|---|---|---|---|---|
| doc-accuracy F1 + code-quality F1 + test-coverage F3 (convergent) | `include/slang.h:1901` | 🟡 Gap (b) public API contradiction | 90 | doc: "The result is in simplified form: `.` and `x/..` segments are collapsed and `/` is used as the separator" vs `MemoryFileSystem::calcCombinedPath` (slang-memory-file-system.cpp:105-128): `combinedPath = Path::combine(...); *pathOut = StringBlob::moveCreate(combinedPath).detach(); return SLANG_OK;` — no simplify (verified directly; zip FS identical) | API clients get different spellings/failure behavior depending on which `ISlangFileSystemExt` implementation answers | Keep |
| doc-accuracy F2 (doc gap) + C002 clarity | `include/slang.h:1909` / `slang-file-system.cpp:86` | 🟡 Gap (b) | 85 (clarity path) | `default: return SLANG_E_INVALID_ARG;` added only to `_calcCombinedPath`; `@returns` line still says "success or failure in loading the file" | Out-of-range path type now fails on OS path but returns SLANG_OK+empty on memory/zip; undocumented in public header | Keep (bundled with row 1) |
| test-coverage F1 + code-quality F4 (convergent) | `slang-file-system.cpp:86-87` | 🟡 Gap (a) missing test | 90 | unit test only passes `SLANG_PATH_TYPE_FILE`/`DIRECTORY`; nothing pins the new invalid-arg branch | Refactor could silently reintroduce old SLANG_OK+empty behavior | Keep |
| test-coverage F2 | `unit-test-file-system.cpp:831` | 🟡 Gap (a) missing test | 85 | doc promises "`/` is used as the separator"; test inputs all use `/` only | Backslash→`/` normalization (a behavior change for Windows embedders) untested | Keep |
| code-quality F2 | `slang-file-system.cpp:102` | 🔵 Question | 80 single agent — fails Question floor as bug-table row, but survives via clarity path C004 (verified: `IncludeSystem::findFile` short-circuit at slang-include-system.cpp:32 vs unconditional simplify) | PR-body claim "absolute spellings remain unsimplified" holds only via one caller | Keep (clarity) |
| code-quality F3 | `slang-file-system.cpp:102` | 🔵 Question | 75 single agent — survives via clarity path C003 | Unstated lexical `x/..` resolution semantics (symlinks, nonexistent segments) | Keep (clarity) |
| test-coverage F4 | `slang-win-visual-studio-util.cpp:315-345` | 🟡 Gap | 80 | Windows-only changes untestable from Linux; PR requests maintainer spot-check | Below 85 floor, single subagent | **Drop** |
| security | `slang-shared-library.cpp:135` | note | <20 | `GetModuleHandleExA` return unchecked — pre-existing, untouched by PR | — | **Drop** (pre-existing, out of scope) |
| test-coverage F5 | `test-14612.slang:14` | clarity nit | 75 | `//CHECK-NOT: ../` — FileCheck pattern is a regex ("any 2 chars + slash") | Future false-fail risk; survives via clarity path FG001 | Keep (clarity) |
| test-coverage F6 | — | note | 95 | 256-char display truncation: PR claims no fix, no test owed | — | **Drop** |
| security (all other items) | — | — | <80 | grow-retry loops, env lookup, executable path — audited, no findings ≥80 | — | Drop |

Clarity candidates C001–C004, FG001–FG004 survived consolidation, scope filtering, and judgment-call resolution (C003/C004 resolved as Keep with verified evidence). Per REVIEW.md, clarity candidates bypass the severity filter and are folded into the single review. Step 5 (GitHub posting) is skipped per instructions — the complete review follows:

---

**Verdict**: 🔴 Has issues — 0 bug(s), 3 gap(s), 2 question(s)

The PR fixes #14612 by simplifying combined paths at construction in `_calcCombinedPath` (so the spelling used for existence checks, unique identity, and loading can't exceed Windows' legacy path limit) and replaces fixed MAX_PATH-family buffers on Windows with grow-retry loops or existing helpers. No correctness or memory-safety issues were found in the grow-retry loops, error propagation, or path-simplification semantics; the surviving findings are contract-level: the new public doc paragraph promises behavior two in-tree implementations of the same interface don't provide, two semantic properties of the new simplify need explicit author confirmation, and two facets of the new behavior lack test pinning. The Windows-only buffer changes are untestable from this environment and need the maintainer spot-check the PR description itself requests.

<details>
<summary>Changes Overview</summary>

**Path simplification at construction** (`source/core/slang-file-system.cpp`, `include/slang.h`)
- `_calcCombinedPath` now applies `Path::simplify` to the combined path and returns `SLANG_E_INVALID_ARG` for out-of-range `SlangPathType` values (previously: unsimplified combination returned verbatim; invalid path types fell through to `SLANG_OK` with an empty blob). The public `calcCombinedPath` doc gained a paragraph promising the simplified form.

**Windows fixed-buffer scrub** (`source/compiler-core/windows/slang-win-visual-studio-util.cpp`, `source/core/slang-shared-library.cpp`, `source/core/slang-platform.cpp`, `source/core/slang-io.cpp`)
- `_readRegistryKey` (RegQueryValueExA) and `getSharedLibraryFileName` (GetModuleFileNameW) now grow-and-retry instead of truncating at MAX_PATH/1024; the vswhere lookup reads `ProgramFiles(x86)`/`ProgramFiles` from the environment instead of `SHGetFolderPathA` (dropping the Shell32 dependency); `PlatformUtil::getInstancePath` reuses `Path::getExecutablePath()` instead of a fixed `_MAX_PATH` buffer; the `GetTempFileNameW` buffer got an explanatory comment (no behavior change — the API takes no size parameter).

**Tests** (`tests/diagnostics/test-14612.slang`, `tests/diagnostics/test-14612-search-dir.slang`, `tests/diagnostics/test-14612/mod14612.slang`, `tools/slang-unit-test/unit-test-file-system.cpp`)
- Two diagnostic regression tests pin the collapsed spelling for both combine branches (relative import and `-I` search directory), plus a cross-platform unit test `calcCombinedPathProducesSimplifiedPaths` pinning `.`/`x/..` collapse and leading-`..` preservation.

</details>

<details>
<summary>Findings (5 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `include/slang.h:1901` | New interface doc promises a simplified result (and a documented failure mode) that `MemoryFileSystem`/`ZipFileSystemImpl` don't return |
| 🔵 Question | `source/core/slang-file-system.cpp:102` | Lexical `x/..` resolution (symlinks, nonexistent segments) is a semantic change that nothing states is intentional |
| 🔵 Question | `source/core/slang-file-system.cpp:102` | "Absolute spellings remain unsimplified" holds only via the `IncludeSystem::findFile` caller, not the changed function |
| 🟡 Gap | `tools/slang-unit-test/unit-test-file-system.cpp:831` | New `SLANG_E_INVALID_ARG` branch and the doc-promised `\`→`/` separator normalization have no test coverage |
| 🟡 Gap | `tests/diagnostics/test-14612.slang:14` | `CHECK-NOT: ../` is a regex (any two chars + slash), not the literal `../`; sibling tests also use inconsistent directive spellings |

</details>

---

### include/slang.h:1901

🟡 **Gap**: New `calcCombinedPath` doc contract is violated by two in-tree implementations

The added paragraph states the simplified form as an unconditional property of the `ISlangFileSystemExt::calcCombinedPath` interface: "The result is in simplified form: `.` and `x/..` segments are collapsed and `/` is used as the separator, matching what getPath() returns for PathKind::Simplified." But the PR only changes the OS-backed `_calcCombinedPath`. `MemoryFileSystem::calcCombinedPath` (source/core/slang-memory-file-system.cpp:105-128) and `ZipFileSystemImpl::calcCombinedPath` (source/core/slang-zip-file-system.cpp:657-680) still return the plain `Path::combine` result — unsimplified, and on Windows assembled with the `\`-preferring delimiter — and `CacheFileSystem` propagates whatever the wrapped implementation returns, so the same call yields different spellings depending on which file system backs the interface. `MemoryFileSystem::getPath(PathKind::Simplified)` does simplify (slang-memory-file-system.cpp:147), so even the "matching what getPath() returns" clause doesn't hold there.

The same asymmetry applies to the failure mode: the PR adds `default: return SLANG_E_INVALID_ARG;` only to `_calcCombinedPath` (source/core/slang-file-system.cpp:86-87), so an out-of-range `SlangPathType` now fails on the OS path but still returns `SLANG_OK` with an empty blob on memory/zip. The edited doc block never mentions the new failure mode, and its `@returns` line still reads "to indicate success or failure in loading the file" — wording left over from load-style docs for a method that performs no I/O. Elsewhere in `slang.h`, new `SLANG_E_INVALID_ARG` conditions are named explicitly (e.g. lines 3377, 5204).

**Example**: a client calls `calcCombinedPath(SLANG_PATH_TYPE_FILE, "a/b/c.slang", "../x.slang", &blob)` first on an `OSFileSystem` (gets `"a/x.slang"`) and then on a `MemoryFileSystem` backing the same sources (gets `"a/b/../x.slang"`), using the result as a cache key or comparing it against `getPath(PathKind::Simplified)` output per the doc — the two disagree.

**Suggested fix**: either make the contract uniform — apply `Path::simplify` and the `default: SLANG_E_INVALID_ARG` case in `MemoryFileSystem::calcCombinedPath` and `ZipFileSystemImpl::calcCombinedPath` (they already run `Path::simplify` on every lookup via `_getCanonical`/`_getFixedPath`, so the doc would then hold everywhere, and the caveat sentence in `slang-file-system.cpp` could be deleted) — or scope the doc sentence to the implementations it describes, and extend `@returns` to name the condition, e.g. "@returns `SLANG_OK` on success, `SLANG_E_INVALID_ARG` if `fromPathType` is not a valid `SlangPathType`".

### source/core/slang-file-system.cpp:102

🔵 **Question**: Is lexical `x/..` resolution intentional, and is "absolute spellings remain unsimplified" meant as a guarantee?

The comment justifies the new `relPath = Path::simplify(relPath);` by the Windows path-length argument, but the change also switches `x/..` from OS resolution to lexical resolution, and nothing states that this semantic difference is accepted. Two decisions need explicit confirmation:

1. **Lexical resolution**: if a path segment is a symlink, `link/../foo/mod.slang` now resolves relative to the link's parent rather than the OS-resolved target's parent; likewise `nonexistent/../x.slang` now resolves where the OS previously returned not-found. This matches the lexical semantics `#include` handling, `CacheFileSystem`, and `getPath(PathKind::Simplified)` already use, so it looks like completing an established policy — but a one-sentence note (in the comment or PR description) that lexical semantics are intentional would let a maintainer confirm the change rather than discover it during a symlink-related bug report.
2. **Absolute spellings**: the PR description says "Absolute import spellings are taken as-is and remain unsimplified", but that property exists only because `IncludeSystem::findFile` short-circuits absolute paths before calling `calcCombinedPath` (source/compiler-core/slang-include-system.cpp:32: `if (fromPath.getLength() == 0 || Path::isAbsolute(path)) { combinedPath = path; }`). The changed function simplifies absolute spellings too, so `CacheFileSystem` (default branch), `RelativeFileSystem`, and any API client passing an absolute `path` get a simplified absolute path back — which is what the new public doc actually promises. If "absolute stays verbatim" is a guarantee, add `Path::isAbsolute` handling inside `_calcCombinedPath` and a doc sentence; if it's an include-system implementation detail, please adjust the PR description so it isn't stated as a general property.

### tools/slang-unit-test/unit-test-file-system.cpp:831

🟡 **Gap**: New `SLANG_E_INVALID_ARG` branch and the doc-promised separator normalization lack test coverage

The unit test pins both valid combine branches, but two behaviors introduced (or promised) by this PR have no test:

1. The new `default: return SLANG_E_INVALID_ARG;` in `_calcCombinedPath` (source/core/slang-file-system.cpp:86-87). Before this PR an out-of-range `SlangPathType` silently returned `SLANG_OK` with an empty blob; per the repo's fail-loudly rule the loud path should be shown to fire, otherwise a later refactor can silently reintroduce the old behavior. One assertion in this test closes it:

```cpp
ComPtr<ISlangBlob> blob;
SLANG_CHECK(SLANG_FAILED(
    fileSystem->calcCombinedPath((SlangPathType)999, "a", "b", blob.writeRef())));
```

2. The public doc explicitly promises "`/` is used as the separator" — a visible behavior change for Windows embedders passing `\`-separated paths (before the fix, `Path::combine` preserved backslash delimiters). The test exercises only forward-slash inputs. Since `Path::isDelimiter`/`kPathDelimiter` are platform-independent, backslash cases are deterministic on all platforms, e.g.:

```cpp
checkCombined(SLANG_PATH_TYPE_FILE, "a\\b\\c.slang", "..\\x.slang", "a/x.slang");
```

### tests/diagnostics/test-14612.slang:14

🟡 **Gap**: `CHECK-NOT: ../` is a FileCheck regex, and the sibling tests use inconsistent directive spellings

LLVM FileCheck treats directive patterns as regexes, so `../` here means "any two characters followed by a slash", not the literal `..` segment. Both tests pass today because the region between the `error[E30015]` line and the `mod14612.slang:5` match contains no other slash, but any future note or secondary span containing a slash in that window would make the test false-fail in a confusing way. `//CHECK-NOT: {{\.\./}}` pins the literal spelling (the same applies to test-14612-search-dir.slang:11).

Minor consistency nit in the same files: test-14612.slang uses `//DIAGNOSTIC_TEST:SIMPLE(...)` while test-14612-search-dir.slang uses `// DIAGNOSTIC_TEST:SIMPLE(...)` (spaced `// CHECK:` lines throughout). The harness tolerates both, but matching the corpus's no-space form keeps the sibling tests reading as one suite.

---

<sub>reviewed: 05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1 · diff sha256 95cdf03eaa17</sub>

## Reviewer B — Devin Review

# Devin Review

_Commit status: **Analysis is up to date (05b7077)**_

## AI Analysis

Combined import paths are now simplified at construction, so .. segments no longer reach existence checks or diagnostics. Windows fixed-size path buffers are replaced with grow-retry logic or existing helpers.

Simplifies calcCombinedPath results with Path::simplify, keeping leading .. segments.
Replaces fixed MAX_PATH buffers in registry, module path, and shared library lookups with grow-retry or helper calls.
Adds regression diagnostic tests and a unit test pinning both combine branches.

Summary .. segments in import paths survived path combination verbatim: existence and identity checks ran on the inflated spelling, which can exceed Windows' legacy ~260-character limit, and import recorded it as the path shown in diagnostics. Combined paths are now simplified at construction, and audited fixed MAX_PATH-family buffers on Windows now grow-retry where the API allows or reuse an existing Slang helper. Absolute import spellings are taken as-is and remain unsimplified.

Root cause _calcCombinedPath (source/core/slang-file-system.cpp:65) never collapsed .. in combined paths.

Tests tests/diagnostics/test-14612.slang and test-14612-search-dir.slang: modules imported through .. paths (relative and via a search directory) must be diagnosed under the collapsed spelling — both fail on unmodified master. calcCombinedPathProducesSimplifiedPaths pins both combine branches in the unit suite (all platforms). tests/diagnostics 1093/1093; full suite 12366/12369 (3 failures pre-exist on master: CUDA PTX JIT).

Risk Low: normalization-only at the path-construction boundary, plus a documented public calcCombinedPath contract and an explicit SLANG_E_INVALID_ARG for invalid path types. The Windows-only scrub cannot be executed from Linux and needs a maintainer spot-check. The reported 256-char display truncation is unreproduced; no speculative fix included.

Fixes #14612

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
Part 1 of 5
0/2
1
Simplify combined paths in calcCombinedPath

The root cause: _calcCombinedPath combined paths verbatim, so dir/../dir/file reached every later operation. The fix simplifies the result at construction via Path::simplify, and rejects invalid path types with SLANG_E_INVALID_ARG. The public header documents the simplified contract.

Part 2 of 5
0/1
2
Grow-retry Windows registry and Visual Studio lookups

RegQueryValueExA previously read into a fixed MAX_PATH buffer, which silently truncated long values. It now loops, growing the List<char> on ERROR_MORE_DATA. The Program Files lookup switches from SHGetFolderPathA into a fixed buffer to the environment-variable helper, with a ProgramFiles fallback for 32-bit Windows.

Part 3 of 5
0/2
3
Grow-retry module path lookups in platform and shared library code

GetModuleFileNameW truncates silently when the buffer is too small and returns the buffer size. getSharedLibraryFileName now loops, growing a List<wchar_t> until the returned length is below capacity. getInstancePath reuses Path::getExecutablePath instead of duplicating a fixed _MAX_PATH query.

Part 4 of 5
0/1
4
Document temp file limit in slang-io.cpp

GetTempFileNameW takes no size parameter, so the buffer cannot grow. This comment records why no retry is possible here.

Part 5 of 5
0/4
5
Add regression diagnostics and unit test

Two diagnostic tests import a module through .. spellings, one relative and one via a search directory, and assert the collapsed path in the error. The unit test checks both combine branches of calcCombinedPath.

End of changes
Chat about this PR
Info
Chat

## Vulnerabilities

(none reported)

## Bugs

Wrong imports through directory symlinks
Bug
slang-file-system.cpp:102
Missing Visual Studio discovery with stripped environments
Bug
slang-win-visual-studio-util.cpp:334

## Flags

Simplified-path guarantee excludes memory and ZIP
Investigate
slang.h:1901-1902
Windows buffer growth lacks regression coverage
Investigate
test-14612.slang:12-15

## Informational

(none reported)

## Reviewer C — Clarity

The pipeline is complete and validated: all postable candidates carry `Status: Keep` with scope/overlap/judgment metadata, dropped candidates are preserved for audit, the Review Body is a strict blockquote with agent attribution, and no proposed comment contains process metadata. Per instructions, I did not post anything to GitHub.

Here is the complete canonical candidate file:

````markdown
# PR 14621 — Clarity Review Workflow (canonical candidates)

REPO: shader-slang/slang
PR: 14621 — "Simplify combined paths and scrub fixed path buffers (fixes #14612)"
Head SHA: 05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1

## PR Summary

The PR has two parts. First, the core fix for #14612: `_calcCombinedPath` in
`source/core/slang-file-system.cpp` now runs `Path::simplify` over the combined path
(collapsing `.` and `x/..` segments, keeping leading `..`), and additionally returns
`SLANG_E_INVALID_ARG` for an invalid `fromPathType`. The simplified-result contract is
documented on the public `ISlangFileSystemExt::calcCombinedPath` in `include/slang.h`.

Second, a Windows audit of fixed `MAX_PATH`-family buffers: `_readRegistryKey` and
`SharedLibraryUtils::getSharedLibraryFileName` now grow-retry;
`_findVersionsWithVSWhere` replaces `SHGetFolderPathA` with `ProgramFiles(x86)` /
`ProgramFiles` environment lookups; `PlatformUtil::getInstancePath` reuses
`Path::getExecutablePath`; the `GetTempFileNameW` buffer stays fixed with a comment
explaining why. Tests: two diagnostic tests pinning the collapsed spelling through both
combine routes (`import` relative path and `-I` search directory), plus a unit test
`calcCombinedPathProducesSimplifiedPaths` pinning both branches on all platforms.

The diff matches the PR description. The description's note that "absolute import
spellings are taken as-is and remain unsimplified" is accurate but corresponds to
pre-existing `IncludeSystem::findFile` behavior (slang-include-system.cpp:32), not to
any change in this diff. Overall the change is well-commented and motivated; the
candidates below are contract-consistency and failure-path clarity issues.

## Review Body

> GLM-authored clarity review:
>
> This PR is in good shape for its size and purpose. The root cause of #14612 is fixed at
> the right layer — path construction, not diagnostics or any downstream consumer — and the
> fix is pinned from three directions: two diagnostic tests covering both combine routes
> (relative import path and `-I` search directory), plus a cross-platform unit test over
> both branches. The comment quality is well above the bar this repo asks for: the memory/zip
> interplay note in `_calcCombinedPath` and the "audited and deliberately left fixed" comment
> over the `GetTempFileNameW` buffer are exactly the durable documentation a future maintainer
> needs. Overall it reads as close to merge-ready rather than rough.
>
> ## Main Concerns
>
> 1. Contract truth on the public interface. The new doc sentence on `calcCombinedPath`
> promises a simplified result, but `MemoryFileSystem` and `ZipFileSystemImpl` still return
> the plain `Path::combine` output (they simplify at lookup time instead), and the new
> `SLANG_E_INVALID_ARG` path is neither mentioned in the public `@returns` (which still
> carries the "success or failure in loading the file" copy-paste) nor covered by the unit
> test — and the memory/zip versions still return `SLANG_OK` + empty for invalid types.
> Decide whether the doc is normative (then align the implementations, which would also
> collapse their duplicated combine logic) or descriptive of the OS implementation (then
> scope the sentence), and pin the error mode with one doc sentence plus one test case.
>
> 2. Failure-path ordering in the new `_readRegistryKey` loop. The "terminate
> unconditionally" step runs before the code knows the query succeeded, resizing and
> writing with a `size` that the API only defines on success and on `ERROR_MORE_DATA`.
> Not a demonstrated bug on current Windows, but it silently relies on undocumented
> behavior in code whose whole job is buffer-contract care, and the sibling
> `GetModuleFileNameW` loop added in the same PR checks failure first — the asymmetry
> makes the registry loop harder to trust.
>
> ## Nits
>
> - "The caller falls back to the registry scan": the caller always scans the registry and
> ignores the vswhere result; one clause describing the real structure would save the reader
> a detour into `WinVisualStudioUtil::find`.
> - The new empty-path check in `getInstancePath` looks redundant with the existing tail
> failure check; either drop it or note the intended distinction.
> - Degenerate empty inputs to `calcCombinedPath` now yield "." (previously ""), which the
> new contract sentence does not predict; one doc clause would close the question.
> - While that body is being rewritten anyway, the unchecked `GetModuleHandleExA` result in
> `getSharedLibraryFileName` would be a cheap deliberate-failure-path addition.
> - Match the `//DIAGNOSTIC_TEST` directive spelling between the two new sibling tests.
>
> The Windows-only parts of this change cannot be exercised from this review environment;
> the maintainer spot-check the PR description requests should cover `_readRegistryKey`, the
> vswhere environment-variable lookup, and `getSharedLibraryFileName` on a real Windows host.

---

## Kept

### C001: Public calcCombinedPath doc promises a simplified result that two in-tree implementations do not return

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: API shape
- Location: `include/slang.h:1901`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/include/slang.h#L1901-L1902
- Overlap decision: Keep
- Overlap rationale: Related to C003 but a different concern at a different anchor (result-form truth across implementations vs the new error contract and its test gap); absorbed FG001's placement point.
- Scope decision: Direct
- Scope rationale: The doc sentence being flagged is added by this PR, and the minimal fix (making the PR's own documentation accurate and normative) requires no out-of-diff work.

Context:

```cpp
/** Calculate a path combining the 'fromPath' with 'path'

The client must ensure the blob be released when no longer used, otherwise memory will leak.

The result is in simplified form: `.` and `x/..` segments are collapsed and `/` is used
as the separator, matching what getPath() returns for PathKind::Simplified.

@param fromPathType How to interpret the from path - as a file or a directory.
...
```

Meanwhile `MemoryFileSystem::calcCombinedPath` (source/core/slang-memory-file-system.cpp:105)
and `ZipFileSystemImpl::calcCombinedPath` (source/core/slang-zip-file-system.cpp:657)
still return the plain `Path::combine` result with no simplification, and the new
comment in `_calcCombinedPath` itself acknowledges this:

```cpp
// The memory and zip file systems implement calcCombinedPath separately and keep the plain
// combination, but they simplify every path they look up themselves
// (MemoryFileSystem::_getCanonical, ZipFileSystemImpl::_getFixedPath), so a combined
// spelling there never reaches a file operation unsimplified either.
```

Proposed comment:

> The new doc sentence on `calcCombinedPath` ("The result is in simplified form: ...")
> reads as a postcondition of the interface, but `MemoryFileSystem::calcCombinedPath`
> and `ZipFileSystemImpl::calcCombinedPath` still return the plain `Path::combine`
> result — the simplification there happens later, at lookup time
> (`MemoryFileSystem::_getCanonical`, `ZipFileSystemImpl::_getFixedPath`). A caller
> holding an `ISlangFileSystemExt*` (including `IncludeSystem::findFile`, which routes
> both `import` and `-I` search-directory resolution through this method) cannot rely
> on the documented form, and a user implementing the interface has no way to tell
> that this sentence is a requirement they must honor rather than an observation about
> the OS file system. Could you make the doc normative ("implementations must return
> the simplified spelling") and align the memory/zip implementations with it — which
> would also let their duplicated combine logic collapse onto a shared helper — or
> scope the claim to the OS-backed implementation and note the lookup-time
> simplification in the other two? While reworking this doc, placing the contract
> sentence directly under the opening method summary (it currently sits between the
> blob-lifetime note and the `@param` list) would also make it the first thing a
> reader sees.

Notes: Strongest contract-consistency issue in the PR. The `_calcCombinedPath` comment
(slang-file-system.cpp:98-101) papers over the same mismatch by explaining the other
implementations instead of aligning them, which is why the fix is best expressed at the
doc/implementation boundary rather than in a local comment. Related: C003 — the error
contract for invalid path types is inconsistent across implementations in the same way
(memory/zip still return `SLANG_OK` with an empty blob for unknown types).

### C002: Registry grow-retry loop terminates the buffer with `size` before checking whether the query succeeded

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: correctness smell
- Location: `source/compiler-core/windows/slang-win-visual-studio-util.cpp:73-77`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/compiler-core/windows/slang-win-visual-studio-util.cpp#L73-L82
- Overlap decision: Keep
- Overlap rationale: No other candidate concerns `_readRegistryKey`; FG006 mentions the loop only as part of a cross-file pattern observation.
- Scope decision: Direct
- Scope rationale: The entire loop is new code added by this PR; the failure-path ordering it questions is introduced by the PR.

Context:

```cpp
        ret = RegQueryValueExA(key, keyName, nullptr, nullptr, (LPBYTE)value.getBuffer(), &size);
        if (ret == ERROR_MORE_DATA)
        {
            value.setCount(size + size / 2);
            continue;
        }
        // A REG_SZ value normally includes its terminator in the returned size; terminate
        // unconditionally (with room made for it) so a value stored without one cannot read
        // past the copied bytes.
        value.setCount(size + 1);
        value[size] = 0;
        break;
    }
    RegCloseKey(key);

    if (ret != ERROR_SUCCESS)
    {
        return SLANG_FAIL;
    }
```

Proposed comment:

> In the new `_readRegistryKey` loop, the "terminate unconditionally" step runs for
> every non-ERROR_MORE_DATA result — including genuine failures such as
> ERROR_FILE_NOT_FOUND — and only afterwards does the function check
> `ret != ERROR_SUCCESS`. Per the RegQueryValueExA contract, `size` is only defined on
> success (bytes copied) and on ERROR_MORE_DATA (required size); on other failure codes
> its value is unspecified, so the unconditional `setCount(size + 1)` / `value[size] = 0`
> resizes and writes using an out-of-contract value, and the comment justifying the
> unconditional termination only covers the success case. Restructuring so the
> success/failure check precedes the termination (or terminating only when
> `ret == ERROR_SUCCESS`) would make both the code and the comment airtight, and would
> keep the failure path from doing bookkeeping with a value the API does not define.

Notes: On current Windows the value is in practice left at the input capacity on error,
so this is not a demonstrated bug — but it silently relies on undocumented behavior in
code whose whole purpose is to be careful about buffer contracts, and a reader cannot
tell from the comment whether the failure path was considered. The `GetModuleFileNameW`
loop added in `getSharedLibraryFileName` does not have this problem because it checks
`length == 0` first; the asymmetry between the two new loops makes the registry one
harder to trust.

### C003: New SLANG_E_INVALID_ARG contract for invalid path types is neither documented nor tested

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/core/slang-file-system.cpp:86`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/core/slang-file-system.cpp#L86-L87
- Overlap decision: Keep
- Overlap rationale: Related to C001 but asks a different thing (document and test the new failure mode) at a different anchor; FG004 covers a different edge case of the same function.
- Scope decision: Direct
- Scope rationale: The `default:` arm and the unit test are both added by this PR; documenting and testing the PR's own new behavior is in scope.

Context:

```cpp
    case SLANG_PATH_TYPE_DIRECTORY:
        {
            relPath = Path::combine(fromPath, path);
            break;
        }
    default:
        return SLANG_E_INVALID_ARG;
    }
```

and the public doc, which still carries a stale `@returns` while gaining the
simplified-form sentence:

```cpp
@param pathOut Holds the string which is the relative path. The string is held in the blob
zero terminated.
@returns A `SlangResult` to indicate success or failure in loading the file.
```

The unit test `calcCombinedPathProducesSimplifiedPaths`
(tools/slang-unit-test/unit-test-file-system.cpp:831-836) exercises only the two valid
path types.

Proposed comment:

> The new `default: return SLANG_E_INVALID_ARG;` introduces a real behavior change on a
> public interface path (an invalid `fromPathType` used to produce `SLANG_OK` with an
> empty blob, which `IncludeSystem::findFile` turns into a failure at its
> `combinedPath.getLength() <= 0` check), but neither the public `calcCombinedPath` doc
> nor the new unit test mentions it. Two small follow-ups would pin the contract: state
> the invalid-argument failure mode in the `@returns` (which currently still reads
> "...success or failure in loading the file", a copy-paste from a load method), and add
> one `checkCombined`-style case asserting `SLANG_E_INVALID_ARG` for an invalid type so
> the contract is enforced per implementation rather than only for the OS file system.

Notes: `MemoryFileSystem::calcCombinedPath` and `ZipFileSystemImpl::calcCombinedPath`
still fall through with `SLANG_OK` + empty for invalid types, so the error contract is
currently inconsistent across implementations in the same way the simplified-form
contract is (see C001). If the intent is that the contract holds interface-wide, the
memory/zip versions need the same `default` arm; if it is OS-specific, the doc should
not imply more than the OS implementation guarantees.

### FG002: "The caller falls back to the registry scan" describes unconditional behavior as if it were a fallback

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/compiler-core/windows/slang-win-visual-studio-util.cpp:325`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/compiler-core/windows/slang-win-visual-studio-util.cpp#L318-L325
- Overlap decision: Keep
- Overlap rationale: Only candidate about `_findVersionsWithVSWhere`; C002 concerns a different function in the same file.
- Scope decision: Direct
- Scope rationale: The comment sentence being flagged is added by this PR.

Context:

```cpp
// block has neither variable, in which case we fail and the caller falls back to the
// registry scan for finding Visual Studio installs.
```

while the caller does:

```cpp
    // Find all versions with vswhere
    _findVersionsWithVSWhere(nullptr, outVersionPaths);
    // Find all with the registry
    _findVersionsWithRegistery(regVersions);
```

Proposed comment:

> One wording precision issue in the new environment-variable comment: it says that on
> failure "the caller falls back to the registry scan", but `WinVisualStudioUtil::find`
> always runs the registry scan and ignores the vswhere result entirely — the scan is
> not triggered by this failure, it just still happens. The observable outcome the
> comment describes (VS installs are still found) is right, but a reader auditing this
> path has to open `find()` to learn the return value of `_findVersionsWithVSWhere` is
> never checked. Saying something like "the caller ignores failure here and always also
> scans the registry" would describe the actual structure and keep the comment from
> implying a conditional fallback that does not exist.

Notes: The rest of the 8-line comment is accurate and well-argued (the 32-bit
`ProgramFiles` fallback and the stripped-environment case both check out against
`PlatformUtil::getEnvironmentVariable`). Only the last sentence overstates the
caller's coupling to this function's result.

### FG003: Redundant empty-pathString check in getInstancePath

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/core/slang-platform.cpp:143`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/core/slang-platform.cpp#L143-L149
- Overlap decision: Keep
- Overlap rationale: Only candidate about `getInstancePath`.
- Scope decision: Direct
- Scope rationale: The early-return block is added by this PR; asking whether it is redundant or intentional is a question about the PR's own change.

Context:

```cpp
    String pathString = Path::getExecutablePath();

    if (pathString.getLength() == 0)
    {
        return SLANG_FAIL;
    }

    // We don't want the instance name, just the path to it
    out.clear();
    out.append(Path::getParentDirectory(pathString));

    return out.getLength() > 0 ? SLANG_OK : SLANG_FAIL;
```

Proposed comment:

> The new `pathString.getLength() == 0` early return appears to duplicate the function's
> existing tail check: when the executable path is empty, `Path::getParentDirectory("")`
> also returns the empty string, so `out` stays empty and the final
> `out.getLength() > 0 ? SLANG_OK : SLANG_FAIL` already returns `SLANG_FAIL` for exactly
> this case. If the early return is intentional (e.g. to separate "query failed" from
> "query returned a bare filename with no directory component", which the tail check
> also catches), a one-line note would make that distinction explicit; otherwise it
> could simply be dropped so the single failure exit at the tail carries the whole
> contract.

Notes: Both paths return the same `SLANG_FAIL` to the same callers
(slang-nvrtc-compiler.cpp:633, :911), so there is no observable behavior difference;
this is purely about the reader's ability to tell whether the added check does
anything.

### FG004: Degenerate empty inputs to calcCombinedPath now produce "." instead of the empty string, and the contract is silent about it

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/core/slang-file-system.cpp:102`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/core/slang-file-system.cpp#L102
- Overlap decision: Keep
- Overlap rationale: Same function as C003 but a different input class and a different ask (empty-input result shape vs invalid-type error mode).
- Scope decision: Direct
- Scope rationale: The `Path::simplify` step that produces the "." result is added by this PR, and the PR's own doc sentence is what leaves the case unspecified.

Context:

```cpp
    relPath = Path::simplify(relPath);

    *pathOut = StringUtil::createStringBlob(relPath).detach();
```

with `Path::simplify(const UnownedStringSlice&)` joining an empty split into ".":

```cpp
/* static */ String Path::simplify(const UnownedStringSlice& path)
{
    List<UnownedStringSlice> splitPath;
    split(path, splitPath);
    simplify(splitPath);

    // Reconstruct the string
    StringBuilder builder;
    join(splitPath.getBuffer(), splitPath.getCount(), builder);
    return builder.toString();
}
```

Proposed comment:

> Edge case worth a sentence somewhere (doc or the new comment block): when the
> combined path is the empty string — e.g. `calcCombinedPath(SLANG_PATH_TYPE_DIRECTORY,
> "", "")` — the new simplification step turns it into "." (an empty split joins as
> "."), where the old code returned the empty string. Real callers such as
> `IncludeSystem::findFile` treat an empty combined path as failure before looking
> anything up, so nothing in-tree is likely to notice, but the public doc now describes
> the result shape without saying anything about empty inputs, and "." vs "" is a
> meaningful difference to an interface caller. Even one clause ("empty inputs yield
> '.'" / "empty inputs are invalid") would close the question.

Notes: Confidence Low because the affected inputs are degenerate; raised because the PR
is precisely about documenting this method's result contract, and this is the one input
class whose output the new contract sentence does not predict.

### FG007: Inconsistent directive spelling between the two new diagnostic test files

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/diagnostics/test-14612-search-dir.slang:1`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/tests/diagnostics/test-14612-search-dir.slang#L1
- Overlap decision: Keep
- Overlap rationale: No other candidate concerns the test files' directive style.
- Scope decision: Direct
- Scope rationale: Both test files are added by this PR, so the inconsistency between them is introduced by the PR.

Context:

test-14612-search-dir.slang:

```slang
// DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK,exit-code=2):-I tests/diagnostics/test-14612/../test-14612
```

test-14612.slang:

```slang
//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK,exit-code=2):
```

Proposed comment:

> Trivial consistency nit between the two sibling tests added in this PR: one spells the
> directive `// DIAGNOSTIC_TEST:...` (space after `//`) and the other
> `//DIAGNOSTIC_TEST:...` (no space). Functionally identical for the test harness, but
> the two files describe the same fix and will be read together, so matching spelling
> (and, ideally, the surrounding repo convention for diagnostic tests) would keep the
> pair uniform.

Notes: Cosmetic; included for line-by-line completeness of the two new test files. The
substantive content of both test comments (why each import route exercises a different
combine branch, why the later `import failed` diagnostic is outside the CHECK-NOT
range) was checked against the include system and is accurate and clear.

### FG005: getSharedLibraryFileName still does not check the GetModuleHandleExA result before using moduleHandle

- Status: Keep
- Confidence: Low
- Scope: Contextual
- Category: correctness smell
- Location: `source/core/slang-shared-library.cpp:142`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/core/slang-shared-library.cpp#L134-L157
- Overlap decision: Keep
- Overlap rationale: Distinct from FG006 (unchecked API result vs loop-duplication pattern) though both concern this function.
- Scope decision: Contextual
- Scope rationale: The unchecked lookup lines are unchanged pre-existing code, but the PR rewrote the function body that consumes the handle, so ownership of the cleanup is arguable.
- Judgment decision: Keep
- Judgment rationale: The PR rewrote the entire body that consumes `moduleHandle` (the overwhelming-majority condition in the scope rules), the fix is a one-line fold-in that would not widen the PR, and the concern is real — an uninitialized handle feeding the new loop — even though the new `length == 0` check makes the outcome incidentally safe; the proposed comment already frames it as a nit while the body is being rewritten, which is fair to the author.

Context:

```cpp
    HMODULE moduleHandle;
    GetModuleHandleExA(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCSTR)symbolInLib,
        &moduleHandle);
    // ... new grow-retry loop reads moduleHandle
```

Proposed comment:

> While rewriting this body: `GetModuleHandleExA`'s result is still unchecked, so on
> failure `moduleHandle` is uninitialized when passed to `GetModuleFileNameW`. The new
> `length == 0` check happens to turn that into "return empty" rather than a garbage
> conversion, which is why this is only a nit — but a `SLANG_RETURN_ON_FAIL`-style check
> on the handle lookup would make the failure path deliberate instead of incidental,
> and would pair naturally with the buffer-loop contract the comment already states.

Notes: The lookup lines are unchanged pre-existing code; kept because the PR rewrote the
consuming body and the comment correctly presents itself as an optional fold-in, not a
demanded fix.

## Dropped

### FG006: Third hand-rolled grow-retry loop in this diff's vicinity; a shared helper may be due

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: organization
- Location: `source/core/slang-shared-library.cpp:140`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/source/core/slang-shared-library.cpp#L140-L157
- Overlap decision: Keep
- Overlap rationale: Distinct from C002/FG005 — it is about the cross-file pattern, not either loop's local correctness.
- Scope decision: Direct
- Scope rationale: The two loops it cites are added by this PR; the open question was usefulness, not ownership.
- Judgment decision: Drop
- Judgment rationale: The proposed comment explicitly requests no change ("Not asking for it in this PR"), so posting it would spend author attention without an actionable ask; revising it into a concrete request would demand a cross-module helper that the four genuinely different retry signals (ERROR_MORE_DATA, returned-length, SLANG_E_BUFFER_TOO_SMALL, capacity compare) make speculative, and the two new loops are individually clear, correct, and documented — the exact situation where the scope filter's broad-refactor drop rule applies.

Context:

```cpp
    // GetModuleFileNameW silently truncates a path that does not fit the buffer and returns the
    // buffer size, so we grow the buffer until the returned length is smaller.
    List<wchar_t> buffer;
    buffer.setCount(1024);
    while (true)
    {
        const DWORD size = DWORD(buffer.getCount());
        const DWORD length = ::GetModuleFileNameW(moduleHandle, buffer.getBuffer(), size);
        ...
        buffer.setCount(size + size / 2);
    }
```

This PR adds two such loops (`_readRegistryKey` in
slang-win-visual-studio-util.cpp:56-79 uses ERROR_MORE_DATA feedback; this one uses
returned-length feedback), alongside the pre-existing `_getExecutablePath`
(slang-io.cpp:1074, SLANG_E_BUFFER_TOO_SMALL feedback) and the `GetTempPathW` loop above
the changed `GetTempFileNameW` comment.

Proposed comment (not posted):

> Small structural observation rather than a request: with this PR the codebase now has
> four hand-rolled grow-retry loops around fixed-size Windows APIs, each with its own
> retry signal but the same 1.5x growth heuristic and the same explanatory comment
> written three times. If another one lands, it may be worth extracting a small named
> helper for the "query into a growable buffer until it fits" shape so the retry
> contracts live in one place.

### FG001: Simplified-form contract sentences placed after the blob-lifetime note instead of with the method summary

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `include/slang.h:1901`
- GitHub link: https://github.com/shader-slang/slang/blob/05b7077ebc32f9828b9012bd6a8fd4ffb24cabc1/include/slang.h#L1897-L1906
- Overlap decision: Merged into C001
- Overlap rationale: The placement request targets the same doc sentences C001 already asks the author to rework, so a single combined request is clearer than two comments on the same lines; C001's proposed comment now carries the placement point.
- Scope decision: Direct
- Scope rationale: The doc lines are added by this PR; dropped only because the concern is merged, not because it is out of scope.

Context:

```cpp
/** Calculate a path combining the 'fromPath' with 'path'

The client must ensure the blob be released when no longer used, otherwise memory will leak.

The result is in simplified form: `.` and `x/..` segments are collapsed and `/` is used
as the separator, matching what getPath() returns for PathKind::Simplified.

@param fromPathType How to interpret the from path - as a file or a directory.
```

Proposed comment (merged into C001):

> Moving the contract sentence up right under the opening "Calculate a path combining
> the 'fromPath' with 'path'" line would make the contract the first thing a reader
> sees, rather than sitting between the blob-release note and the `@param` list.

Notes: Absorbed into C001's proposed comment verbatim-in-substance; dropped here to
avoid two comments on the same doc lines.
````

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":3,"questions":2,"diff_hash":"95cdf03eaa177af428cc90bce10a633234c4975b63a0acc1452481e182797b74","reviewers_complete":true}
```
