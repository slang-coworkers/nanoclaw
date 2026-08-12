---
title: "[approver/challenger-win] compile-perf native tools compiled out-of-band by bench.py escape CMake CI — a Windows include-order 🔴 is real and CI-invisible"
type: learning
topic: ci-tooling
source: learnings/1784147373872-approver-challenger-win-compile-perf-native-tools-.md
---

# [approver/challenger-win] compile-perf native tools compiled out-of-band by bench.py escape CMake CI — a Windows include-order 🔴 is real and CI-invisible

**Symptom.** PR #12125 (shader-slang/slang, jvepsalainen-nv, compile-perf memory-footprint tracking) added a new `tools/compile-perf/native/api-driver.cpp` that includes `<psapi.h>` *before* `<windows.h>`. The production `github-actions[bot]` review flagged it 🔴 (undefined `DWORD`/`HANDLE` → Windows build fails). Decision = BLOCK/RED_BUG @3304a7a64e29.

**Root cause / why it's real (not a false positive).** `psapi.h` uses Win32 types (`DWORD`, `HANDLE`, `PROCESS_MEMORY_COUNTERS`) from `windows.h`/`windef.h` and does NOT self-include `windows.h` — the canonical MSDN gotcha is "include windows.h first." I verified the file's earlier includes (`slang.h`, `slang-com-ptr.h`→`slang-com-helper.h`, and the std headers `<algorithm>/<chrono>/<cstdio>/…`) do NOT pull in `windows.h`, and the Win32 branch of `currentRssKb()` genuinely uses `PROCESS_MEMORY_COUNTERS`/`GetProcessMemoryInfo`. So the ordering is a real PR-introduced compile break, in a brand-new (+81) file.

**The transferable catch — CI green ≠ this file builds.** The critical challenger move: check *how* the changed native file is compiled. `api-driver.cpp` is NOT in any CMakeLists (grep the tree confirms). `bench.py:build_api_driver()` compiles it at bench time via `cl.exe -nologo -O2 -std:c++17 -EHsc -I{inc} src -Fe:{out}` (no `/FI` forced-include, no PCH) on the Windows perf runner. Therefore the repo's in-progress Windows CMake CI builds do NOT compile this file and would NOT catch the break — their going green is not evidence the 🔴 is cleared. `ci_green_on_sha` passing (or the policy not requiring it) says nothing here.

**How to catch it.** For any compile-perf / dev-tooling PR touching a `native/*.cpp` (or any source not wired into CMake): before trusting CI, grep for how that file is built. If a Python harness (`bench.py`, a `build_*` helper) shells out to `cl.exe`/`c++` to compile it, CI is blind to it — a build-break 🔴 there is real and latent on the out-of-band runner, and directly defeats a PR whose purpose is *that* platform (here: "make the Windows perf runner record RSS instead of null").

**Calibration vs the #12118 over-caution lesson.** Prior recall (#12118, same author, same read-suite line) warned that titular-scope OPEN_GAP on internal tooling is over-cautious — I leaned CLEAR-as-advisory there and it was right. This is the *opposite* case and the distinction matters: #12118's remainders were pre-existing same-class *robustness gaps*; #12125's 🔴 is an *introduced, verified compile break*. The "internal tooling → lean clear" heuristic applies to advisory 🟡 gaps, NOT to a verified 🔴 build break. Don't let the internal-tooling context soften a red. (The 3 🟡 gaps here — get() spurious 0kb sample, page-size truncation, [MEM] tab-parse — I did leave as advisory/moot under BLOCK, consistent with #12118.)

**Devin note.** Devin ran head-current, returned 0 bugs, and its own rendered diff panel *displayed* the psapi/windows include block — yet it did not flag the ordering. A clean Devin pass is not counter-evidence to a primary-tier 🔴; treat Devin as a supplementary signal, never a veto over the production review.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784147373872-approver-challenger-win-compile-perf-native-tools-.md`_
