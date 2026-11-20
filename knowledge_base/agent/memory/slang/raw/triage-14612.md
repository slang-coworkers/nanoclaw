---
type: triage
---
# Triage: shader-slang/slang#14612 — Windows: Slang compiler truncates long paths in diagnostics
Date: 2026-11-18 | Category: bug (robustness/QoI; core truncation symptom unconfirmed in-tree) | Severity: medium | Priority: P2 | Component: frontend (include system + core file utilities)

## What's broken / being requested
Reporter (tangent-vector, core team): on Windows, paths >256 ASCII chars (from `..`-heavy include
chains) appear truncated to 256 chars in diagnostic messages. Asks (a) full path always printed,
`..`-simplification acceptable; (b) a general scrub of path handling, since silent truncation in
FS APIs would be worse than a display bug.

## Repro
- Reporter's sketch: deep nesting + `..`-heavy `#include` chains, diagnostic from a file whose
  combined path >256 chars. No concrete dir tree/command given yet.
- Ours (Linux, top-of-tree Release slangc, binary newer than HEAD 4a1d62c5b): 268-char relative
  path (`d/dirNNN.../leaf.slang`, 16 nested dirs) printed IN FULL in the diagnostic — NO
  truncation. Also an `..`-chain include (12 leading `..`s) printed in full.
- Windows truncation: NOT reproducible from this Linux container (no Windows host). Do not guess.

## Codebase digest (file:line pointers; all verified by direct read or audited subagent)
- Diagnostic path pipeline is heap `String` end-to-end: `PathInfo::foundPath`
  (compiler-core/slang-source-loc.h:126) → `DiagnosticSink` prints via unbounded StringBuilder
  (compiler-core/slang-diagnostic-sink.cpp:156); rich renderer same
  (compiler-core/slang-rich-diagnostics-render.cpp:718,1041). No `char[2xx]`/MAX_PATH buffer in
  this chain (repo-grep + audit).
- `_calcCombinedPath` (core/slang-file-system.cpp:65-88) is plain `Path::combine` — NO `..`
  collapsing; combined path is used VERBATIM for existence check (compiler-core/
  slang-include-system.cpp:55), unique identity (:63), and stored as foundPath (:75).
- Simplification happens only LATER, at preprocessor include handling
  (source/slang/slang-preprocessor.cpp:3681 `simplifyPath` → PathKind::Simplified →
  `Path::simplify`, core/slang-io.cpp:517-543, which collapses `x/..` but KEEPS leading `..`).
  So the existence/identity FS calls see the longest, unsimplified spelling.
- Windows FS layer passes FULL-length wide paths to `_wstat64` (core/slang-io.cpp:190,646),
  `_wfsopen` (core/slang-stream.cpp:180), `FindFirstFileW` (:879), `_wfullpath(nullptr,…,0)`
  heap-alloc (core/slang-io.cpp:684-696). No `\\?\` long-path prefixing anywhere, longPathAware
  manifest unknown. On default Windows configs these calls FAIL (do not truncate) when the
  effective absolute path >260 chars → include-not-found / cannot-open, not silent truncation.
- REAL fixed-size MAX_PATH-family buffers exist OFF the user-source chain (scrub targets):
  - core/slang-platform.cpp:137 `wchar_t path[_MAX_PATH]` + GetModuleFileNameW —
    PlatformUtil::getInstancePath silently truncates at 259.
  - core/slang-io.cpp:108 `wchar_t[MAX_PATH+1]` GetTempFileNameW (temp-only).
  - source/slang/slang-win-visual-studio-util.cpp:57,304 `char value[MAX_PATH]` /
    `programFilesPath[_MAX_PATH]` (VS discovery).
  - source/slang/slang-shared-library.cpp:139-140 `wchar_t filenameBuffer[1024]`.
  - Grow-retry safe pattern already exists: core/slang-io.cpp:78-96, 981-1011.

## Candidate approaches
### Approach A: simplify combined include paths at the producer (RECOMMENDED core fix)
- Where: `Path::simplify` the result in `_calcCombinedPath` (core/slang-file-system.cpp:65-88),
  or equivalently simplify in `IncludeSystem::findFile` before the `getPathType` check
  (compiler-core/slang-include-system.cpp:53-55).
- Behaviour delta: existence + unique-identity checks run on the minimal `..`-collapsed
  spelling, so a `..`-inflated path whose simplified form fits under Windows' 260-char limit
  resolves instead of failing; stored foundPath is minimal (preprocessor:3681 becomes a no-op).
- Tradeoffs: canonicalization already collapses `x/..` later, so this moves the simplification
  earlier — no new representation (Path::simplify is the existing single source of truth).
  Leading `..`s correctly remain (can't be resolved without a base).
- Risk: low — pure normalization at the existing path-construction boundary.
### Approach B: scrub the audited fixed MAX_PATH buffers with grow-retry
- Where: the four buffer sites above, using the grow-retry pattern at slang-io.cpp:78-96.
- Behaviour delta: exe path / VS discovery / shared-library lookup no longer silently truncate
  (or fail) on long installs. None are on the user-source/diagnostic chain.
- Tradeoffs: Windows-only code, untestable from Linux; needs code review + maintainer spot check.
- Risk: low, mechanical.
### Approach C: Windows long-path enablement (`\\?\` prefixing or longPathAware manifest)
- Behaviour delta: >260-char absolute paths work for stat/open on Windows.
- Tradeoffs: real design surface (manifest policy, relative-path semantics of `\\?\`), larger
  blast radius; flag for maintainer decision rather than bundling into this fix.
- Risk: medium.

## Recommended path
A (primary, producer-side, principled: normalization at the construction boundary; testable
on Linux — see acceptance) + B (mechanical hygiene the maintainer explicitly asked for).
C parked for maintainer direction. The reported 256-char diagnostic truncation itself has NO
in-tree root cause (verified empirically + audit); it must NOT be "fixed" speculatively —
we ask the reporter for the exact Windows repro (dir tree, command, and where output was
captured) in the triage comment. Do not apply `reproduced` (Windows-only, cannot verify here).

## Acceptance criteria
- A: a Linux-reproducible test — e.g. an include whose combined spelling contains `a/x/../b`
  segments whose simplified form is much shorter — asserts the diagnostic prints the simplified
  path (today the pre-simplify spelling is used for identity; post-fix nothing changes on Linux
  except earlier normalization; the test should assert foundPath/uniqueIdentity are the
  simplified spelling). Full slang-test suite green on Linux.
- B: code review only (Windows-only); no behavior change on Linux; suite green.
- Explicitly out of scope: any change claimed to fix the 256-truncation without a reproduced
  Windows root cause.

## Sources
- Local audit subagents (2 independent: diagnostics pipeline; Windows FS layer) — digests above.
- DeepWiki Q&A: path-to-diagnostic flow confirms simplifyPath-before-SourceFile and no fixed
  buffer in snippets; Windows FS API audit confirms wide-API usage, no long-path evidence.
- gh dup search (path truncation / long path / MAX_PATH / "256 in:body"): no duplicates.
