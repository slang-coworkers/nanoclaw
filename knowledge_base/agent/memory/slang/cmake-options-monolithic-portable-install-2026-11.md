---
type: chain
description: Weekly CMake Options on master red since 11-04 — portable raytracing module installs loose .slang-module under SLANG_BUILD_MONOLITHIC_STANDARD_MODULE_LIBRARY=ON
---

# CMake Options red: monolithic std-module lib + portable raytracing install (11-07)

**Found** by slang-discord-support (msg 511784). Scheduled `CMake Options` run 42353637429 on master
`ae4e57957a` finished `failure` at 12:53Z. 13 of 491 jobs failed: every `SLANG_BUILD_MONOLITHIC_STANDARD_MODULE_LIBRARY=ON`
entry, plus `check-cmake`. The install check reports a loose `slang/raytracing/portable.slang-module`.

**Verified by me (source at HEAD):**
- `source/standard-modules/raytracing/portable/CMakeLists.txt:87-90` `install()`s unconditionally.
- `numerics/CMakeLists.txt` registers its outputs in `SLANG_STANDARD_MODULE_FILES` and guards its install on `NOT …MONOLITHIC…`.

Likely cause: #14051 (kaizhangNV, merged 11-04) landed after #14001 (lujinwangnv, merged 11-03). Both authors are human,
not our bot. I didn't confirm the log line myself: `--log-failed` returned nothing to grep.

**Dispatched** 11-07 ~13:05Z to slang-triager on thread `ci-cmake-options-monolithic-portable-install-20261107` (511785).
It confirms the error, dedupes, and files ONE issue: no @-mentions, "Related: #14051, #14001", no fixer chain. Once it
files, record the issue number here and in index.md. Its issue_opened webhook needs NO dispatch.

**11-07 13:12Z: filed as #14400** (I checked it on GitHub: OPEN, bot-authored, `reproduced`, no assignee, no @-mentions, no "Fixes").
The triager confirmed the log line and reproduced it locally on `ae4e57957a` in about 3 min. The portable module is
also missing from `SLANG_STANDARD_MODULE_FILES`/`_TARGETS`. No duplicate; #13997 is the feature request. It is
not labelled `regression`, because the monolithic matrix entry is new since 11-03. **FILED-ONLY, no fixer chain.** A fix
needs a manual CMake Options `workflow_dispatch` to verify. ⚠️ That run is 490 jobs and fills the hosted cap, so dispatch
it only with `max-parallel` or at a quiet time.
