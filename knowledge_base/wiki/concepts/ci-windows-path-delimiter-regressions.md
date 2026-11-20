---
title: "Windows path-delimiter regressions: Path::simplify flips \\ to / and kOSCanonicalPathDelimiter consumers break"
type: concept
group: ci-tooling
tags: [ci, windows, path-delimiter, slang-io, kOSCanonicalPathDelimiter, platform-regression, slang]
source_count: 2
---

# Windows Path-Delimiter Regressions

## TL;DR

- **Normalizing combined-path separators breaks Windows consumers that parse paths with `Path::kOSCanonicalPathDelimiter`.** `kOSCanonicalPathDelimiter` is `\` on Windows and `Path::combine` joins with it, but `Path::simplify` rejoins with `kPathDelimiter` (`/`) on every platform — any change that runs `simplify` over a combined/found path flips Windows spellings from `\` to `/`.
- **The failure is deterministic, Windows-release-only, and invisible on Linux** (`/` is already `kPathDelimiter` there), so the CI Windows legs are the ONLY authoritative signal; local Linux suite greenness is not evidence about it.
- **`indexOf` → −1 → `tail(-1)` walks one byte BEFORE the string in release builds** — garbage paths, null lookups, no assert. Debug builds assert; release fails silently.
- **Before landing a path-spelling normalization, grep for `kOSCanonicalPathDelimiter` consumers** — don't assume only the tests visible on Linux are affected.
- **Priority-yield-cancelled CI runs hide such regressions for hours** — the first fully-executed Windows run can come ~5h after the code lands, so a "green" branch can still carry a deterministic Windows-only failure.

## The regression class and its worked case

`kOSCanonicalPathDelimiter` is `\` on Windows (`source/core/slang-io.h:100`) and `Path::combine` joins with that preferred delimiter (`slang-io.cpp:317`), while `Path::simplify` rejoins with `kPathDelimiter` = `/` on every platform. Any change that runs `Path::simplify` over a combined/found path therefore flips Windows spellings from `\` to `/` — and code that does `path.indexOf(Path::kOSCanonicalPathDelimiter)` then gets −1, where `UnownedStringSlice::tail(-1)` silently walks one byte BEFORE the string in release builds (garbage paths, null lookups, no assert). The concrete casualty on slang#14621 (2026-11-19) was `multiFileModuleCache.internal`: the module foundPaths were saved with the new always-`/` simplified spelling, the cache lookup sliced at `kOSCanonicalPathDelimiter`, got −1 → `tail(-1)` → garbage save paths → Phase-2 loadModule nullptr abort — a deterministic failure on `test-windows-release-cl-*` only, invisible on Linux ([Path::simplify flips Windows `\` to `/` in foundPaths](../learnings/1795065993573-path-simplify-flips-windows-to-in-foundpaths-kosca.md)). The incident was first misreported as "CI green" because the fixer's report counted auxiliary workflows — the full CI-verdict discipline for that misread (main ci.yml legs, mid-run check-runs, priority-yield windows) is on [reading GitHub CI state](ci-c-reading-ci-state.md); the false "green" would have relayed upstream as fact while two Windows legs were already red [Verify "CI green" against main CI run legs, not auxiliary workflows](../learnings/1795135619924-verify-ci-green-against-main-ci-run-legs-not-auxil.md).

When a path-spelling normalization lands, grep for `kOSCanonicalPathDelimiter` consumers before assuming only tests visible on Linux are affected, and treat a Linux-only local verification as non-evidence about the Windows legs: classify a Windows-leg CI failure on such a PR as a real PR regression until proven infra (compare the legs against sibling PR runs before calling infra).

---

**Source learnings (2):**

- [#14621: Path::simplify flips Windows `\`→`/`; kOSCanonicalPathDelimiter consumers indexOf −1, `tail(-1)` OOB in release; grep consumers; yield-cancelled CI hides Windows regressions; format every edited file.](../learnings/1795065993573-path-simplify-flips-windows-to-in-foundpaths-kosca.md)
- [the same incident's CI-verdict lesson: multiFileModuleCache regression was Windows-legs-only, and "CI green (3 runs success)" read auxiliary workflows; CI legs were the only authoritative signal.](../learnings/1795135619924-verify-ci-green-against-main-ci-run-legs-not-auxil.md)

_Catalog: [index](../index.md)_
