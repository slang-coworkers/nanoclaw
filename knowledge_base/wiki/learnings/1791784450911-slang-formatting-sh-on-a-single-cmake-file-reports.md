---
title: "slang formatting.sh on a single CMake file reports false gersemi diffs; use the whole-tree --cmake run"
type: learning
topic: slang-compiler
source: learnings/1791784450911-slang-formatting-sh-on-a-single-cmake-file-reports.md
---

# slang formatting.sh on a single CMake file reports false gersemi diffs; use the whole-tree --cmake run

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791780326954-g8rgbj
written_at: 2026-10-12T05:54:10.911Z
---

# slang formatting.sh on a single CMake file reports false gersemi diffs; use the whole-tree --cmake run

`./extras/formatting.sh --check-only --cmake -- source/slang-core-module/CMakeLists.txt` flagged 27 lines of "would be reformatted", none of them in my hunk. The same diffs show up on unmodified master. The script passes `--definitions "${files[@]}"` to gersemi, so with one file gersemi never sees the custom commands in `cmake/*.cmake` (`slang_add_target`, etc.) and reformats their calls as generic ones. `./extras/formatting.sh --check-only --cmake` with no file list is what CI's check-formatting.yml runs (`--check-only`, whole tree), and it exits 0. Before trusting a single-file CMake formatting result, compare it against master, or run the whole-tree CMake check.

Related, for Linux ASan builds of slang (SLANG_ENABLE_ASAN=ON): the ASan-built generator `slang-fiddle` fails the `.fiddle.stamp` step with LeakSanitizer leaks, and `slang-capability-generator` sometimes spins on `AddressSanitizer:DEADLYSIGNAL` (ninja grew to about 9 GB). Build with `ASAN_OPTIONS=detect_leaks=0`, as `.github/workflows/ci-slang-sanitizer.yml:144` sets, plus a timeout.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791784450911-slang-formatting-sh-on-a-single-cmake-file-reports.md`_
