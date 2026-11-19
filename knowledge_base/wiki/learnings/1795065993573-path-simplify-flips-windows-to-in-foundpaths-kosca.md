---
title: "Path::simplify flips Windows `\` to `/` in foundPaths — kOSCanonicalPathDelimiter parsers get indexOf -1 and tail(-1) walks OOB in release; format every edited file; yield-cancelled CI hides Windows regressions"
type: learning
topic: ci-tooling
source: learnings/1795065993573-path-simplify-flips-windows-to-in-foundpaths-kosca.md
---

# Path::simplify flips Windows `\` to `/` in foundPaths — kOSCanonicalPathDelimiter parsers get indexOf -1 and tail(-1) walks OOB in release; format every edited file; yield-cancelled CI hides Windows regressions

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040604442-eq59hj
written_at: 2026-11-19T05:26:33.573Z
---

# Path::simplify flips Windows `\` to `/` in foundPaths — kOSCanonicalPathDelimiter parsers get indexOf -1 and tail(-1) walks OOB in release; format every edited file; yield-cancelled CI hides Windows regressions

**Windows delimiter regression class (slang#14621, 2026-11-19): normalizing combined-path separators breaks consumers that parse foundPaths with `Path::kOSCanonicalPathDelimiter`.** `kOSCanonicalPathDelimiter` is `\` on Windows (`source/core/slang-io.h:100`) and `Path::combine` joins with that preferred delimiter (`slang-io.cpp:317`), while `Path::simplify` rejoins with `kPathDelimiter` = `/` on every platform. Any change that runs `Path::simplify` over a combined/found path therefore flips Windows spellings from `\` to `/` — and code that does `path.indexOf(Path::kOSCanonicalPathDelimiter)` then gets −1, where `UnownedStringSlice::tail(-1)` silently walks one byte BEFORE the string in release builds (garbage paths, null lookups, no assert). Concrete casualty: `multiFileModuleCache.internal` — deterministic failure on test-windows-release-cl-* only, invisible on Linux (`/` == kPathDelimiter there). Two process traps in the same incident: (1) run clang-format on EVERY edited file including unit tests you don't normally touch — a 101-char line failed the formatting CI check that gates the PR; (2) priority-yield-cancelled CI runs hide regressions for hours — the first fully-executed Windows run came ~5h after the code landed, so a "green" branch can still carry a deterministic Windows-only failure. When a path-spelling normalization lands, grep for `kOSCanonicalPathDelimiter` consumers before assuming only tests/x visible on Linux are affected.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795065993573-path-simplify-flips-windows-to-in-foundpaths-kosca.md`_
