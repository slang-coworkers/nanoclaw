---
type: source
description: "slang-reviewer R1 combined review of PR #14621 (#14612 Windows long-path scrub, path simplification + wide-API diagnostics), 2026-11-19: REQUEST_CHANGES, 0 bugs / 6 gaps / 0 questions, drift 0 (Devin fresh; key gaps = hand-rolled grow-retry loops duplicating existing helpers, slang.h doc contract vs Memory/Zip calcCombinedPath implementations). Verbatim memo; distilled into slang/14612-windows-long-path-truncation-diagnostics.md."
okf_synth: exempt
---

# Combined PR Review — shader-slang/slang#14621 (pr)

Model deviation note: open-weights group (NANOCLAW_MODEL_WEIGHTS=open) — Reviewers A and C ran on OpenCode with nvidia/zai-org/glm-5.3 (OPENCODE_MODEL), not the claude CLI. Reviewer B (Devin) is Devin's own analysis.

## Reviewer A — Correctness (nv-slang-bot)

All verification is complete. Building the editorial table and composing the final review.

**Editorial table (Step 3 filter):**

| Source agent | file:line | Severity | Confidence | Evidence / verification quote | User-visible impact | Keep/Drop |
|---|---|---|---|---|---|---|
| code-quality gap4 + clarity C001 | slang-win-visual-studio-util.cpp:320 | Gap | 85 | "`ProgramFiles(x86)` is only defined on 64-bit processes" vs documented WOW64 env block | Misleading comment | **Keep** |
| code-quality gap1 + clarity C002 | slang-platform.cpp:142 | Gap | 85 | New loop vs `_getExecutablePath` (slang-io.cpp:1074) / `PlatformUtil::getEnvironmentVariable` (slang-platform.cpp:378) | Duplication of existing mechanism | **Keep** |
| code-quality gap3 + clarity C003 | slang-file-system.cpp:93 | Gap | 85 | `relPath = Path::simplify(relPath);` vs slang.h:1897 "Calculate a path combining..." | Public API output silently changed, undocumented | **Keep** |
| code-quality gap2 + clarity C004 | slang-file-system.cpp:93 | Gap | 85 | `Path::isAbsolute(path)` → `combinedPath = path` (include-system:32) + getPathType-before-simplify (slang-io.cpp:712) | Absolute `..` paths still fail >260-char limit | **Keep** |
| test-coverage finding 1 | tests/diagnostics/test-14612.slang:11 | Gap | 85 | `findFile(SLANG_PATH_TYPE_DIRECTORY, dir.path, ...)` — DIRECTORY branch unpinned | Missing test for changed behavior | **Keep** |
| test-coverage finding 2 | slang-platform.cpp:142 | Gap | 80 | unit-test-library-unload-memory.cpp:375 | Windows-only, marked acceptable by own reviewer | Drop (<85) |
| security sub-threshold ×4 | various | Bug/Q | 15–30 | n/a | Theoretical DWORD wrap / env redirect / symlink nuance | Drop (<85) |
| clarity F001 + verified dead-code | slang-win-visual-studio-util.cpp:61 | Gap (nit) | 85 | `DWORD size = 0;` dead init; grep: `shlobj.h`/`Shell32` only used by removed `SHGetFolderPathA` code | Dead code left by PR | **Keep** (bundled) |

All three dispatched reviewers completed; the clarity pass (5 surviving candidates) is folded in below.

---

**Verdict**: 🔴 Has issues — 0 bug(s), 6 gap(s)

The PR fixes #14612 by collapsing `..`/`.` segments in combined paths at the `_calcCombinedPath` boundary and replacing fixed `MAX_PATH`-family buffers on Windows with grow-retry loops. The buffer rewrites are individually correct — they eliminate two real pre-existing failure modes (silent truncation; reading an uninitialized stack buffer when `SHGetFolderPathA`/`GetModuleFileName` fails) — and `Path::simplify` at the combine boundary is the right layer, repairing both the `import` and `#include` existence-check stages. The findings below are scope and consistency gaps rather than correctness bugs: an undocumented residual hole for absolute paths, a stale public `calcCombinedPath` contract, grow loops that re-implement existing helpers, one factually wrong comment, an unpinned test branch, and minor dead-code leftovers.

<details>
<summary>Changes Overview</summary>

**Path simplification at the combine boundary** (`source/core/slang-file-system.cpp`, `tests/diagnostics/test-14612.slang`, `tests/diagnostics/test-14612/mod14612.slang`)
- `_calcCombinedPath` now runs `Path::simplify` on the combined path before returning it, so the collapsed spelling is what every later operation (existence check, unique identity, loading) and every diagnostic sees. The new diagnostic regression test pins that an import spelled with a `..` segment is reported under the collapsed path.

**Windows fixed-buffer scrub** (`source/compiler-core/windows/slang-win-visual-studio-util.cpp`, `source/core/slang-platform.cpp`, `source/core/slang-shared-library.cpp`, `source/core/slang-io.cpp`)
- The registry-key read (`RegQueryValueExA`), the ProgramFiles lookup (now via `GetEnvironmentVariableA` with a `ProgramFiles` fallback instead of `SHGetFolderPathA`), and both `GetModuleFileNameW` queries now grow-retry rather than truncate or read uninitialized buffers; `slang-io.cpp` gains a comment-only explanation of why `GetTempFileName` cannot grow.

</details>

<details>
<summary>Findings (6 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/core/slang-platform.cpp:142` | Three hand-rolled grow-retry loops re-implement existing helpers (`Path::getExecutablePath`, `PlatformUtil::getEnvironmentVariable`) |
| 🟡 Gap | `source/compiler-core/windows/slang-win-visual-studio-util.cpp:320` | `ProgramFiles(x86)` comment states the wrong bitness as the fallback's rationale; `res == 0` contract unpinned |
| 🟡 Gap | `source/core/slang-file-system.cpp:93` | Public `calcCombinedPath` contract not updated for the new simplification/separator normalization |
| 🟡 Gap | `source/core/slang-file-system.cpp:93` | Absolute import paths with `..` still bypass the fix; scope boundary unstated |
| 🟡 Gap | `tests/diagnostics/test-14612.slang:11` | Search-directory (`SLANG_PATH_TYPE_DIRECTORY`) combine branch's simplified output has no regression test |
| 🟡 Gap | `source/compiler-core/windows/slang-win-visual-studio-util.cpp:61` | Minor dead code left by the PR: dead `size` initializer; `<shlobj.h>` include and `Shell32` pragma no longer needed |

</details>

<sub>reviewed: cff7171da007689a941ec786ae110e3909cabed6 · diff sha256 6be255ba1ea1</sub>

---

## Inline comments

**`source/core/slang-platform.cpp:142`**

🟡 **Gap**: Three hand-rolled grow-retry loops duplicate existing helpers

The repo convention ("Reuse before you write; then extract"; "Keep one source of truth") applies to the three new loops added by this PR. `PlatformUtil::getInstancePath` re-implements a `GetModuleFileNameW` grow loop that is exactly "parent directory of `Path::getExecutablePath()`" — `_getExecutablePath` (`source/core/slang-io.cpp:1074`) already wraps the same `GetModuleFileNameW(GetModuleHandle(nullptr), ...)` query in a grow-retry loop, and `slang-platform.cpp` already includes `slang-io.h`. Likewise, the inline `GetEnvironmentVariableA` loop in `_findVersionsWithVSWhere` (`source/compiler-core/windows/slang-win-visual-studio-util.cpp:324`) duplicates the portable, unbounded `PlatformUtil::getEnvironmentVariable` (`source/core/slang-platform.cpp:378`, `_dupenv_s`-based, no fixed buffer at all), which compiler-core already uses for `CUDA_PATH`; with it, the `ProgramFiles(x86)` → `ProgramFiles` fallback becomes two simple calls. `getSharedLibraryFileName` (`source/core/slang-shared-library.cpp:143`) adds a third copy of the loop shape.

**Example**: `getInstancePath` could be implemented as `out.append(Path::getParentDirectory(Path::getExecutablePath()))`, eliminating this entire loop and reusing a path that is already exercised elsewhere; the vswhere lookup becomes `PlatformUtil::getEnvironmentVariable("ProgramFiles(x86)", out) || PlatformUtil::getEnvironmentVariable("ProgramFiles", out)`.

**Suggested fix**: Implement `getInstancePath` via `Path::getExecutablePath()`, use `PlatformUtil::getEnvironmentVariable` for the env lookup, and — if the raw `GetModuleFileNameW(HMODULE)` loop shape is still needed in two places — extract it into one named, documented helper shared by `slang-platform.cpp` and `slang-shared-library.cpp`. (The registry loop in `_readRegistryKey` has no existing helper and is fine as written.)

**`source/compiler-core/windows/slang-win-visual-studio-util.cpp:320`**

🟡 **Gap**: `ProgramFiles(x86)` comment states the wrong bitness as the fallback's rationale

Two accuracy issues in this comment block. First, the claim that `ProgramFiles(x86)` "is only defined on 64-bit processes" is wrong about which bitness matters: per Microsoft's documented WOW64 environment block (learn.microsoft.com, "WOW64 Implementation Details" / "Environment Variables"), `%ProgramFiles(x86)%` is defined on 64-bit **Windows** for both 32- and 64-bit processes (a 32-bit WOW64 process sees both `ProgramFiles=C:\Program Files (x86)` and `ProgramFiles(x86)`), and it is only absent on 32-bit Windows. The fallback ordering still yields the correct directory on 32-bit Windows (where `%ProgramFiles%` is `C:\Program Files`, where the VS Installer lives), so behavior is fine — only the stated reason misleads. Second, the `res == 0` break is what makes the fallback work — `GetEnvironmentVariableA` returns 0 both for an undefined variable and for an empty one — but nothing pins that contract.

**Suggested fix**: Reword to something like: "`ProgramFiles(x86)` is only defined on 64-bit Windows; on 32-bit Windows the same folder is `%ProgramFiles%`, so we fall back to that name (a zero result covers both an undefined and an empty variable)."

**`source/core/slang-file-system.cpp:93`**

🟡 **Gap**: Public `calcCombinedPath` contract not updated for the new simplification/separator normalization

Besides collapsing `x/..` pairs, `Path::simplify` rebuilds the path with `/` separators (`kPathDelimiter`, `source/core/slang-io.cpp:560`), so this change also silently normalizes backslash-separated combined paths on Windows: a shader writing `import "subdir\mod.slang"` now gets the module recorded and diagnosed as `subdir/mod.slang`. That is arguably an improvement (it matches `getPath(PathKind::Simplified)`, as the new comment notes), but `calcCombinedPath` is a public COM interface method (`include/slang.h:1897`, documented only as "Calculate a path combining the 'fromPath' with 'path'") whose observable output changed with no doc update and no test pinning the normalized spelling. The old behavior was itself inconsistent (foundPath kept `\` while unique identity used `/`), so the change is defensible — it just needs the contract recorded.

**Suggested fix**: Add one sentence to the `calcCombinedPath` doc in `slang.h` ("the result is in simplified form: `.`/`x/..` segments collapsed, `/` separators") and add a test importing through a `./`- or backslash-spelled path to pin the normalized output.

**`source/core/slang-file-system.cpp:93`**

🟡 **Gap**: Absolute import paths with `..` still bypass the simplification

The root cause fixed here (`_calcCombinedPath` never collapsing `..`) is only reachable for relative imports: `IncludeSystem::findFile` (`source/compiler-core/slang-include-system.cpp:32`) passes absolute paths through verbatim (`if (fromPath.getLength() == 0 || Path::isAbsolute(path)) { combinedPath = path; }`), so `import "C:/dir1/../dir2/…/mod.slang"` longer than the legacy ~260-char limit still fails on Windows before any simplification happens — `Path::getCanonical`'s Windows branch calls `getPathType` on the unsimplified spelling first (`source/core/slang-io.cpp:712-713`). The linked issue #14612 explicitly asks for "scrubbing path handling in general", but the PR description and the new code comment don't state that absolute spellings remain outside the fix.

**Suggested fix**: Either state the scope limit explicitly (in the PR description and/or the code comment), or simplify the absolute candidate too — e.g. in `IncludeSystem::findFile`'s absolute branch, `combinedPath = Path::simplify(path)` — with a test using an absolute `..` import on Windows.

**`tests/diagnostics/test-14612.slang:11`**

🟡 **Gap**: Search-directory combine branch's simplified output has no regression test

`_calcCombinedPath` has two combine shapes, and the new `Path::simplify` line applies to both — but this test only drives the `SLANG_PATH_TYPE_FILE` branch (import relative to the importing file). Any import found through a search directory combines via `findFile(SLANG_PATH_TYPE_DIRECTORY, dir.path, pathToInclude, outPathInfo)` (`source/compiler-core/slang-include-system.cpp:125-136`), and a `-I` path containing `..` segments hit the exact same inflated-path bug class as #14612 pre-fix; no existing test covers that route (none of the tests under `tests/` use a search directory with `..`). Both branches now share the one added line, so the regression risk is small, but the second branch's fixed behavior is unpinned.

**Suggestion**: Add a sibling test exercising the search-directory route (the bare import name is not file-relative, so it falls through to the DIRECTORY combine), reusing the existing helper module:

```
//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK,exit-code=2):-I tests/diagnostics/test-14612/../test-14612

import "mod14612.slang";
//CHECK: error[E30015]
//CHECK-NOT: ../
//CHECK: tests/diagnostics/test-14612/mod14612.slang:5
```

Alternatively, a two-line assertion in a `tools/slang-unit-test/` path/file-system test that `calcCombinedPath(SLANG_PATH_TYPE_DIRECTORY, "a/b/../b", "f.slang")` yields `"a/b/f.slang"` would pin the contract at unit level and run on all platforms.

**`source/compiler-core/windows/slang-win-visual-studio-util.cpp:61`**

🟡 **Gap**: Minor dead code left by the PR (bundled nits)

Two small leftovers: (1) `DWORD size = 0;` here is dead — `size` is assigned as the first statement of every loop iteration (`size = DWORD(value.getCount());`), so declaring it inside the loop (or dropping the initializer) makes the value's origin clearer. (2) After this PR removes the `SHGetFolderPathA`/`GetConsoleWindow` call site, the `#include <shlobj.h>` (line 11) and `#pragma comment(lib, "Shell32")` (line 17) in this file no longer serve any code — per the repo convention of deleting dead code after a refactor, they should go too.

**Suggested fix**:

```cpp
List<char> value;
value.setCount(MAX_PATH);
while (true)
{
    DWORD size = DWORD(value.getCount());
    ...
```

and remove the `shlobj.h` include and `Shell32` pragma.

---

All three dispatched reviewers (code-quality, security, test-coverage) completed; the security reviewer found no issues at or above its confidence floor (the PR is a net security improvement — it removes silent truncation, an out-of-bounds read on terminator-less registry strings, and an uninitialized-stack-buffer executable path). The six findings above are the survivors of the editorial filter and the clarity-candidate pass (consolidation, scope filtering, and judgment-call resolution applied; dropped items preserved in `tmp/review-candidates/pr-14612-clarity-workflow.md` for audit).

## Reviewer B — Devin Review

# Devin Review

_Commit status: **Analysis is up to date (cff7171)**_

## AI Analysis

Combined import paths now collapse redundant parent-directory segments before later file operations. Windows path lookups retry with larger buffers when their APIs report truncation.

Normalize relPath at path construction so file checks and diagnostics use the simplified spelling.
Grow buffers for registry values, environment variables, and module filenames when Windows APIs signal insufficient capacity.
Add a diagnostic regression test that checks the collapsed import path.

Summary .. segments in import paths survived path combination verbatim: existence and identity checks ran on the inflated spelling, which can exceed Windows' legacy ~260-character limit, and import recorded it as the path shown in diagnostics. Combined paths are now simplified at construction, and audited fixed MAX_PATH-family buffers on Windows now grow-retry where the API allows.

Root cause _calcCombinedPath (source/core/slang-file-system.cpp:65) never collapsed .. in combined paths.

Tests tests/diagnostics/test-14612.slang: a module imported through a .. path must be diagnosed under the collapsed spelling (fails before, passes after). tests/diagnostics 1092/1092; full suite 12364/12367 (3 failures pre-exist on master: CUDA PTX JIT).

Risk Low: normalization-only at the path-construction boundary. The Windows-only scrub needs a maintainer spot-check. The reported 256-char display truncation is unreproduced; no speculative fix included.

Fixes #14612

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
Part 1 of 3
0/1
1
Simplify combined paths before file operations

The combined spelling is consumed by checks, identity lookup, loading, and diagnostics, so normalize it at construction rather than fixing each caller. Path::simplify removes resolvable x/.. pairs while retaining leading unresolved .. segments.

Part 2 of 3
0/4
2
Retry Windows path lookups with larger buffers

Replace fixed-size assumptions only for APIs that expose truncation or the required capacity. Registry reads retry on ERROR_MORE_DATA and explicitly terminate the returned value; environment lookup retries for ProgramFiles(x86) then falls back to ProgramFiles. GetModuleFileNameW retries until its result fits, for both executable-directory and shared-library paths. GetTempFileNameA/W remains constrained because it provides no capacity feedback.

Part 3 of 3
0/2
3
Verify collapsed spelling in import diagnostics

The fixture imports its module through a path containing .., then checks that the undefined-symbol diagnostic names the collapsed module path without emitting the unsimplified segment. The auxiliary module supplies the diagnostic trigger.

End of changes
Chat about this PR
Info
Chat

## Vulnerabilities

(none reported)

## Bugs

Wrong imports through directory symlinks
Bug
slang-file-system.cpp:93
Missing Visual Studio discovery with stripped environments
Bug
slang-win-visual-studio-util.cpp:350

## Flags

Windows buffer growth lacks regression coverage
Investigate
test-14612.slang:12-15

## Informational

(none reported)

## Reviewer C — Clarity

The clarity review pipeline is complete. Below is the full canonical candidate file content:

```markdown
# Clarity Review Candidates — PR #14621 (canonical workflow file)

Consolidated from `tmp/review-candidates/pr-14621-clarity.md` (high-level) and
`tmp/review-candidates/pr-14621-fine-grained-clarity.md` (fine-grained), then scope-filtered and
judgment-resolved in place. This is the canonical file for the clarity review of
"Simplify combined paths and scrub fixed path buffers (fixes #14612)".

## PR Summary

The PR fixes issue #14612 at the root-cause layer: `_calcCombinedPath`
(source/core/slang-file-system.cpp) previously combined paths verbatim, so an `import` through a
path with `..` segments was recorded, checked for existence, and reported in diagnostics under the
inflated spelling, which can cross Windows' legacy ~260-character path limit. The fix adds a
`Path::simplify` at the construction boundary, with a regression test
(tests/diagnostics/test-14612.slang) that asserts the diagnostic appears under the collapsed
spelling. The rest of the diff scrubs fixed `MAX_PATH`-family buffers on Windows: `_readRegistryKey`
and `PlatformUtil::getInstancePath` grow-retry instead of truncating,
`SharedLibraryUtils::getSharedLibraryFileName` returns the real path instead of an empty string,
the vswhere lookup replaces `SHGetFolderPathA` (no size feedback) with the
`ProgramFiles(x86)`/`ProgramFiles` environment variables, and a comment-only hunk in
`File::generateTemporary` records why `GetTempFileNameW` deliberately does *not* grow-retry.

The diff matches the PR description, which also honestly notes the Windows-only scrub needs a
maintainer spot-check. One small title/body nuance: the body summarizes the vswhere change as
"grow-retry where the API allows", but that hunk actually *replaces* `SHGetFolderPathA` with
`GetEnvironmentVariableA` because the old API cannot report size at all — consistent in spirit,
slightly broader in fact. Overall a small, focused, well-motivated change; the added comments are
individually strong, and the candidates below are mostly about cross-implementation consistency
and comment precision, not about correctness of the fix itself.

## Candidates

### C001: Combined-path "minimal spelling" invariant is only enforced in one of the calcCombinedPath implementations

- Status: Keep
- Confidence: High
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The comment stating the invariant is added by this PR, and the PR makes the other implementations' silence about it newly misleading.
- Category: invariant
- Location: `source/core/slang-file-system.cpp:86`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-file-system.cpp#L86-L93
- Overlap decision: Keep
- Overlap rationale: Unique cross-implementation invariant concern; FG001 addresses a different (local control-flow) problem in the same function.

Context:

```cpp
    // The combined path is the spelling used for every later operation on the file (existence
    // checks, unique identity, loading), so it must be the minimal one: a path assembled with
    // `..` segments, like `dir/../dir/file.slang`, inflates the effective length, and on Windows
    // a path over the legacy ~260-character limit makes those operations fail even though the
    // equivalent simplified path would fit. `Path::simplify` collapses `x/..` pairs, matching
    // what `getPath(PathKind::Simplified)` returns for the same path, and keeps leading `..`
    // segments, which cannot be resolved without an absolute base.
    relPath = Path::simplify(relPath);
```

Proposed comment:

> The new comment states the invariant as if it were universal — "the combined path is the spelling used for every later operation on the file, so it must be the minimal one" — but this PR only enforces it in one of the three `calcCombinedPath` implementations. `MemoryFileSystem::calcCombinedPath` (source/core/slang-memory-file-system.cpp:105) and `ZipFileSystemImpl::calcCombinedPath` (source/core/slang-zip-file-system.cpp:657) still combine paths verbatim, so an `import "dir/../dir/file.slang"` resolved through a memory or zip file system is still recorded and looked up under the inflated spelling. It would help a future maintainer if either (a) the combine-then-simplify step were factored into one shared helper that all three implementations call, so the invariant holds everywhere by construction, or (b) the comment scoped the claim to OS-backed file systems and said why the in-memory/zip implementations do not need the same treatment.

Notes:
The comment itself is well written (it gives the motivating `dir/../dir/file.slang` example and the Windows length limit). The concern is the gap between the stated invariant and where it is enforced. The memory file system does exact-string key lookup, so a `..` path through it is arguably already out-of-contract input; that is exactly the kind of "why the others are exempt" reasoning that should be recorded rather than left implicit.

### FG001: `_calcCombinedPath` has no default case; an invalid `fromPathType` now flows into `Path::simplify("")` and yields `"."`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The `Path::simplify` line is added by this PR and silently changes the out-of-contract output from an empty blob to `"."`.
- Category: control flow
- Location: `source/core/slang-file-system.cpp:93`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-file-system.cpp#L71-L96
- Overlap decision: Keep
- Overlap rationale: Same function as C001 but a genuinely distinct problem (out-of-contract case analysis vs cross-implementation invariant).

Context:

```cpp
    String relPath;
    switch (fromPathType)
    {
    case SLANG_PATH_TYPE_FILE: { relPath = Path::combine(...); break; }
    case SLANG_PATH_TYPE_DIRECTORY: { relPath = Path::combine(...); break; }
    }

    relPath = Path::simplify(relPath);
    *pathOut = StringUtil::createStringBlob(relPath).detach();
    return SLANG_OK;
```

Proposed comment:

> The switch has no `default`, so an out-of-range `fromPathType` (this is a public `ISlangFileSystemExt` method, so an external implementation or client could pass garbage) leaves `relPath` empty. Before this change that produced an empty blob; now the empty string flows into `Path::simplify`, which joins zero segments into `"."`, so the function silently succeeds and hands back `"."` as a combined path. Both behaviors are garbage-out for garbage-in, but per this repo's "fail loudly on out-of-contract input" convention, a `default:` that returns `SLANG_E_INVALID_ARG` (or an assert) would make the contract explicit instead of changing the garbage silently.

Notes:
Low confidence: the enum is almost certainly always valid in practice, and the pre-existing shape was already silent about it. Raised because the PR changes the out-of-contract output (empty → `"."`) without recording a decision. Verified `Path::join` with `count == 0` emits `"."` (source/core/slang-io.cpp:549).

### FG004: The GetTempFileName comment says the API "accepts a buffer of MAX_PATH characters" while the buffer below is `MAX_PATH + 1`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The comment is added by this PR; the inconsistency is between two PR-added/PR-shown lines.
- Category: comments
- Location: `source/core/slang-io.cpp:108`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-io.cpp#L108-L113
- Overlap decision: Keep
- Overlap rationale: Only candidate on this hunk; unrelated to the grow-retry loop family.

Context:

```cpp
        // GetTempFileNameA/W generates a name from the temp path and accepts a buffer of
        // MAX_PATH characters; it cannot report a required size, so there is nothing to grow
        // into here: a temp directory longer than the legacy path limit makes the call fail
        // regardless of this buffer's size. (The temp path lookup above grows, so only an
        // unusually deep system temp directory reaches that limit.)
        wchar_t wideChars[MAX_PATH + 1];
```

Proposed comment:

> Minor inconsistency: the comment states the API "accepts a buffer of MAX_PATH characters" while the buffer right below it is declared `MAX_PATH + 1`. The point of the comment (GetTempFileName takes no size parameter, so there is nothing to grow into — it either fits the legacy limit or fails) comes across, but the off-by-one between the stated capacity and the actual array invites a reader to puzzle over which number is authoritative. Aligning the two (or dropping the exact count) would remove the tripwire. Also "GetTempFileNameA/W" — only the W variant is called in this code.

Notes:
The comment-only hunk is a good idea in general (recording why this buffer deliberately does NOT grow-retry like its neighbors). This candidate is purely about the MAX_PATH vs MAX_PATH+1 wording.

### C002: Five hand-rolled grow-retry loops; the two GetModuleFileNameW loops duplicate the same API contract and near-identical comments

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Scope decision: Direct
- Scope rationale: All five loops (and their comments) are introduced by this PR; the duplication question is created by the change.
- Category: organization
- Location: `source/core/slang-platform.cpp:138`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-platform.cpp#L138-L160
- Overlap decision: Keep
- Overlap rationale: The high-level duplication request; FG002 (registry loop readability) and FG005 (one comment's ambiguity) cover distinct local problems, and FG006 was merged into this candidate.

Context:

```cpp
    // GetModuleFileNameW silently truncates a path that does not fit the buffer and returns the
    // buffer size, so we grow the buffer until the returned length is smaller; a fixed _MAX_PATH
    // buffer would report the truncated path of an executable installed in a long directory.
    List<wchar_t> buffer;
    buffer.setCount(_MAX_PATH);
    while (true)
    {
        const DWORD size = DWORD(buffer.getCount());
        const DWORD res =
            ::GetModuleFileNameW(::GetModuleHandleW(nullptr), buffer.getBuffer(), size);
        ...
        buffer.setCount(size + size / 2);
    }
```

Proposed comment:

> This PR adds five hand-rolled grow-retry loops across three files: `RegQueryValueExA` (slang-win-visual-studio-util.cpp:57), `GetEnvironmentVariableA` (slang-win-visual-studio-util.cpp:315), `GetModuleFileNameW` here, and `GetModuleFileNameW` again in `SharedLibraryUtils::getSharedLibraryFileName` (source/core/slang-shared-library.cpp:140). The two `GetModuleFileNameW` loops wrap the identical API with the identical loop shape and near-duplicate comments, differing only in initial capacity and local names — including the returned length being named `res` here (which reads like a SlangResult) and `length` there. Per this repo's conventions ("reuse before you write; then extract non-trivial logic into a named, documented helper"), one documented helper owning the GetModuleFileNameW contract — truncation returns the buffer size, `0` means failure — would encode the subtlety once instead of restating it per call site. If a shared helper is deliberately rejected (e.g. to keep each file self-contained), a brief note saying the duplication is intentional would help reviewers.

Notes:
The individual loops are correct and each comment is individually fine; the concern is repetition of a subtle API contract in multiple places, which invites drift (the growth strategies already differ: `size + size / 2` here and in the registry loop, `res + 1` in the env-var loop). A pre-existing grow-retry loop for `GetTempPathW` already exists in source/core/slang-io.cpp:78 using `_alloca`, so there is precedent for per-site loops; the candidate therefore asks for either extraction or an explicit statement, not a mandatory refactor. FG006 (naming inconsistency between the two loops) was merged into this proposed comment.

### FG005: In `getSharedLibraryFileName`, the parenthetical "(or empty)" does not say whose behavior it describes

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The comment is added by this PR; the ambiguity is in the new text itself.
- Category: comments
- Location: `source/core/slang-shared-library.cpp:142`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-shared-library.cpp#L140-L142
- Overlap decision: Keep
- Overlap rationale: A distinct comment-ambiguity problem; resolving C002's duplication would not by itself fix this sentence.

Context:

```cpp
    // GetModuleFileNameW silently truncates a path that does not fit the buffer and returns the
    // buffer size, so we grow the buffer until the returned length is smaller; a fixed buffer
    // would return the truncated path of a library installed in a long directory (or empty).
```

Proposed comment:

> The parenthetical "(or empty)" is ambiguous about whose behavior it describes. With a fixed buffer, the Win32 API itself returns the truncated path; returning *empty* was this function's old behavior — the removed code explicitly checked `length == maxLength` and returned `String()`, so the truncation case never actually escaped. A reader who does not have the old code in mind cannot tell whether "(or empty)" is an API behavior, the old function behavior, or a third failure mode. One clarifying clause — e.g. "(the old code detected this case and returned an empty string, losing the path entirely)" — would pin the reference.

Notes:
Related: C002. The new loop itself is clear and correct.

### FG002: In the registry grow-retry loop, `size` plays three roles; the growth expression only reads correctly if you notice the API overwrote it

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The loop and its comment are introduced by this PR.
- Category: comments
- Location: `source/compiler-core/windows/slang-win-visual-studio-util.cpp:71`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/compiler-core/windows/slang-win-visual-studio-util.cpp#L57-L83
- Overlap decision: Keep
- Overlap rationale: Same loop family as C002 but a distinct local readability problem in the RegQueryValueExA loop, which is not one of the two GetModuleFileNameW duplicates.

Context:

```cpp
    while (true)
    {
        size = DWORD(value.getCount());
        ret = RegQueryValueExA(key, keyName, nullptr, nullptr, (LPBYTE)value.getBuffer(), &size);
        if (ret != ERROR_MORE_DATA)
        {
            break;
        }
        value.setCount(size + size / 2);
    }
```

Proposed comment:

> In this loop `size` carries three different meanings in the space of four lines: buffer capacity on entry to the call, required size in bytes when the API reports `ERROR_MORE_DATA`, and bytes copied on success. The comment does say the required size is reported "in `size`", but a maintainer editing this code can still easily miss that `size + size / 2` grows to 1.5× the API-reported requirement rather than 1.5× the current buffer — the two readings differ, since `size` was assigned from `value.getCount()` two lines up. Splitting the variable (e.g., `DWORD capacity = value.getCount();` passed to the call, with the API-reported requirement read out of `size` afterwards), or one extra comment clause stating "grow to 1.5× the required size", would remove the ambiguity. Note the sibling `GetEnvironmentVariableA` loop in this same PR grows to exactly `res + 1` instead, so the growth policy is currently inconsistent between the two loops.

Notes:
The loop is correct as written (on `ERROR_MORE_DATA` `size` receives the required byte count including the terminator for `REG_SZ`, so 1.5× is always sufficient). This is purely about whether a future reader can reconstruct that. Related: C002.

### FG003: The vswhere env-var comment's key claim — "`ProgramFiles(x86)` is only defined on 64-bit processes" — should be spot-checked before merge

- Status: Revise
- Confidence: Low
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The comment is added by this PR, and the claim is the stated reason the fallback exists.
- Category: comments
- Location: `source/compiler-core/windows/slang-win-visual-studio-util.cpp:318`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/compiler-core/windows/slang-win-visual-studio-util.cpp#L315-L321
- Overlap decision: Keep
- Overlap rationale: Distinct from C003, which covers the new failure-mode contract of the same block; this candidate covers the factual accuracy of the comment's justification.
- Judgment decision: Revise
- Judgment rationale: Focused analysis cannot settle the bitness claim without a live Windows system (no 32-bit test process can run in this environment, and repo grep shows no prior art deciding it); the comment is load-bearing for the fallback design, so a verification request is credible and useful, but the wording must present the uncertainty honestly rather than implying the claim is wrong.

Context:

```cpp
    // We read the folder through its environment variables rather than SHGetFolderPathA:
    // SHGetFolderPathA writes into a caller-allocated MAX_PATH buffer and gives no size
    // feedback, so a longer path would be silently truncated, while GetEnvironmentVariableA
    // reports the required size and allows a grow-retry. `ProgramFiles(x86)` is only defined on
    // 64-bit processes; a 32-bit process finds the same folder under `ProgramFiles`, so we fall
    // back to that name.
```

Proposed comment:

> Worth a maintainer spot-check (the PR description itself asks for one on the Windows-only changes): the fallback to `ProgramFiles` rests on the claim that `ProgramFiles(x86)` "is only defined on 64-bit processes". I could not verify the bitness scope from the Microsoft docs alone — the variable is documented as available on 64-bit Windows, and 32-bit processes there have `ProgramFiles` redirected to the x86 folder, so whether `ProgramFiles(x86)` is unset for them or simply redundant is hard to tell from the docs. The code looks correct under every reading — the first name wins on 64-bit, and the fallback covers 32-bit Windows, where `ProgramFiles` is the x86 folder — but if the bitness claim is off, the comment gives future maintainers the wrong model of *why* the fallback exists. If the real intent is "cover 32-bit processes and 32-bit Windows in one list", stating that directly would be more robust than the bitness claim.

Notes:
Judgment call resolved to Revise: the original proposed comment leaned toward asserting the claim was wrong; follow-up analysis confirmed only that the docs are ambiguous from here, so the posted request is an honest spot-check ask rather than a correction. The PR body already invites a maintainer spot-check for the Windows-only scrub, which makes this cheap to answer.

### C003: New env-var lookup adds a failure mode the old SHGetFolderPathA path practically never had; the only caller silently ignores it

- Status: Keep
- Confidence: Low
- Scope: Direct
- Scope decision: Direct
- Scope rationale: The early `SLANG_FAIL` return is added by this PR, so documenting its contract is owned by this PR.
- Category: function contract
- Location: `source/compiler-core/windows/slang-win-visual-studio-util.cpp:349`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/compiler-core/windows/slang-win-visual-studio-util.cpp#L349-L352
- Overlap decision: Keep
- Overlap rationale: Distinct from FG003 — this covers the unexplained failure mode, not the accuracy of the fallback rationale.

Context:

```cpp
    if (programFilesPath.getLength() == 0)
    {
        return SLANG_FAIL;
    }
```

Proposed comment:

> The switch from `SHGetFolderPathA` to reading `ProgramFiles(x86)`/`ProgramFiles` introduces a new failure mode: `SHGetFolderPathA` practically always succeeds, while a process with a stripped environment block (e.g. a minimal service context) has neither variable, and `_findVersionsWithVSWhere` now returns `SLANG_FAIL` early. The comment above the loop explains why the env-var route is preferable (size feedback vs silent truncation) but does not say why the new failure mode is acceptable. Since the only caller (`WinVisualStudioUtil::find`, in the same file) discards the result and silently falls back to the registry scan, a sentence noting that — e.g. "callers treat failure as 'vswhere unavailable' and fall back to the registry" — would make the contract complete.

Notes:
Low confidence because the fallback behavior is real and the change is arguably strictly safer than the old truncating lookup; this is a request for the failure-mode contract to be recorded, not a claim of a bug. The early `SLANG_FAIL` return is also the only place this function can now fail before `ProcessUtil::execute`, so documenting it is cheap.

## Review Body

> GLM-5.3-authored clarity review:
>
> ## PR State
>
> Small, well-scoped change: a root-cause fix (`Path::simplify` at the combined-path construction
> boundary) with a regression test that fails on the old behavior, plus a sweep of the fixed
> `MAX_PATH`-family Windows buffers. The comments are unusually good for a scrub like this — each
> rewrite names the Win32 API contract it works around, the test comment walks the mechanism end
> to end, and the one buffer that deliberately does *not* grow (`GetTempFileNameW`) gets a
> comment explaining why. This feels close to merge-ready; the candidates below are mostly about
> cross-implementation consistency and comment precision, not correctness of the fix.
>
> ## Main Concerns
>
> 1. **The new "combined path is the minimal spelling" invariant is enforced in only one of the
>    three `calcCombinedPath` implementations.** `MemoryFileSystem` and `ZipFileSystemImpl` still
>    combine verbatim. Either factor the combine-then-simplify step into a shared helper so the
>    invariant holds by construction, or scope the comment and say why the other implementations
>    are exempt. This is the one candidate I'd want addressed before merge.
> 2. **Five hand-rolled grow-retry loops, two of them wrapping the same `GetModuleFileNameW`
>    contract with near-duplicate comments and different growth strategies.** A single documented
>    helper owning that contract — or an explicit "duplication is intentional" note — would keep
>    the subtlety from drifting between copies.
> 3. Smaller, non-blocking nits: the `size` variable in the registry grow-retry loop plays three
>    roles in four lines; a few comment phrasings are ambiguous or off by one (the "(or empty)"
>    parenthetical in `getSharedLibraryFileName`, and the MAX_PATH vs MAX_PATH+1 mismatch in the
>    `GetTempFileNameW` comment); the vswhere env-var lookup gains a failure mode whose handling
>    (registry fallback in the only caller) deserves one sentence; and the comment's bitness
>    claim about `ProgramFiles(x86)` is worth the maintainer spot-check the PR description
>    already asks for.

## Dropped

Dropped, duplicate, superseded, and merged candidates are preserved below for auditability.

### FG006: Same API, different local names: `res` in `getInstancePath` vs `length` in `getSharedLibraryFileName`

- Status: Drop
- Confidence: Low
- Scope: Direct
- Scope decision: Direct
- Scope rationale: In scope, but subsumed by the broader duplication candidate.
- Category: naming
- Location: `source/core/slang-shared-library.cpp:148`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-shared-library.cpp#L140-L158
- Overlap decision: Merged into C002
- Overlap rationale: If the two GetModuleFileNameW loops are extracted into the helper C002 requests, the naming inconsistency disappears; C002's revised proposed comment now names the `res`-vs-`length` drift explicitly.

Context:

```cpp
    // slang-shared-library.cpp
    const DWORD length = ::GetModuleFileNameW(moduleHandle, buffer.getBuffer(), size);
    // ... vs slang-platform.cpp:
    const DWORD res = ::GetModuleFileNameW(::GetModuleHandleW(nullptr), buffer.getBuffer(), size);
```

Proposed comment:

> Nit: the two `GetModuleFileNameW` loops introduced by this PR name the returned character count differently — `length` here, `res` in `PlatformUtil::getInstancePath` — and `res` reads like a status/result code (in this codebase `res` usually holds a `SlangResult`), not a length. If the loops are extracted into a shared helper the naming converges for free; otherwise picking one name (`length`) for both would keep the duplicated loops easy to compare.

Notes:
Merged into C002's proposed comment rather than posted separately, to avoid two comments on the same duplication problem.

### FG007: `GetModuleHandleExA` result and uninitialized `moduleHandle` sit directly above the rewritten loop (pre-existing, untouched)

- Status: Drop
- Confidence: Low
- Scope: Contextual
- Scope decision: Out-of-scope
- Scope rationale: Pre-existing defect on lines this PR does not modify; the rewritten loop below does not change these lines' contract.
- Category: correctness smell
- Location: `source/core/slang-shared-library.cpp:137`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/source/core/slang-shared-library.cpp#L133-L139
- Overlap decision: Keep
- Overlap rationale: No overlap with another candidate; dropped on scope grounds only.

Context:

```cpp
    HMODULE moduleHandle;
    GetModuleHandleExA(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCSTR)symbolInLib,
        &moduleHandle);
```

Proposed comment:

> Pre-existing, and this PR does not make it worse, so feel free to ignore here: `moduleHandle` is left uninitialized when `GetModuleHandleExA` fails, and its return value is not checked, so the new loop below can call `GetModuleFileNameW` with a garbage handle (which then fails and returns empty, so it degrades rather than crashes). Since the function was being rewritten anyway, checking the `GetModuleHandleExA` result and returning `String()` on failure would have made the contract airtight for about two lines.

Notes:
Dropped by the scope filter: the `GetModuleHandleExA` lines are context, not changed lines, and the concern predates the PR. Recorded in case a maintainer wants a drive-by fix.

### FG008: Coverage audit trail for regions reviewed with no candidate

- Status: Drop
- Confidence: High
- Scope: Direct
- Scope decision: Direct
- Scope rationale: Not a review candidate; retained as the generation coverage audit trail.
- Category: comments
- Location: `tests/diagnostics/test-14612.slang:3`
- GitHub link: https://github.com/shader-slang/slang/blob/cff7171da007689a941ec786ae110e3909cabed6/tests/diagnostics/test-14612.slang#L1-L15
- Overlap decision: Keep
- Overlap rationale: Audit-trail entry, not a comment on the code.

Context:

```cpp
//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK,exit-code=2):
import "test-14612/../test-14612/mod14612.slang";
//CHECK: error[E30015]
//CHECK-NOT: ../
//CHECK: tests/diagnostics/test-14612/mod14612.slang:5
```

Proposed comment:

> (No comment — audit trail entry.)

Notes:
Audit trail, not a candidate. The following changed regions were inspected and judged obviously clear/necessary, with no lingering question: (1) `tests/diagnostics/test-14612.slang` — the regression-test comment accurately explains the mechanism (verified: `#include` simplifies `foundPath` at source/slang/slang-preprocessor.cpp:3681 while import path resolution via `Linkage::findFile` does not), the CHECK/CHECK-NOT/CHECK ordering scopes the `../` prohibition correctly, and the note about the later `import failed` diagnostic is precise; (2) `tests/diagnostics/test-14612/mod14612.slang` — trivial auxiliary module, clear; (3) the `#include "slang-list.h"` additions in slang-platform.cpp and slang-shared-library.cpp match each file's existing include style; (4) the `GetTempFileNameW` call site itself is unchanged and the new comment correctly explains why it deliberately does not grow; (5) the `_readRegistryKey` terminator comment (slang-win-visual-studio-util.cpp:80-81) accurately captures the REG_SZ terminator subtlety; (6) `PlatformUtil::getInstancePath`'s new early `SLANG_FAIL` on `res == 0` and the retained "We don't want the instance name" comment read clearly.
```

## Result (machine-readable)

```json
{"verdict":"REQUEST_CHANGES","bugs":0,"gaps":6,"questions":0,"diff_hash":"6be255ba1ea1b7a908326de11b147460a72d30f3da03712e2986cace46d60cf2","reviewers_complete":true}
```
