---
title: "slang-test: matching an expanded subtest name needs exact testName equality, not getSubtestIndex"
type: learning
topic: slang-compiler
source: learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md
---

# slang-test: matching an expanded subtest name needs exact testName equality, not getSubtestIndex

slang-test's expanded subtest display name is `<path>[.<idx>][ syn][ (<api>)]`, built per-subtest in `_runTestsOnFile` (tools/slang-test/slang-test-main.cpp, after the `testName` StringBuilder is assembled).

To skip/select ONE api/synthesized variant (e.g. `tests/compute/parameter-block.slang.6 syn (llvm)`):
- `getSubtestIndex(prefix, filePath)` (slang-test-main.cpp:~4910) returns -1 unless everything after the `.` is **all digits** — so it CANNOT parse the full display name (the space after `.6` ends parsing). It only matches the index-level stem `<path>.<idx>`.
- The positive `-test-prefix` selector compares against `outputStem` (`<path>.<idx>`, no syn/api), so it also can't single out one variant.
- ⇒ Match the full variant by **exact equality against the assembled `testName`** (`StringBuilder : public String`, so `testName == entry` uses `String::operator==`).

Subtest **0** edge case: its stem has no `.0` (code only appends `.idx` when `idx != 0`), but `-dry-run` PRINTS `.0` for the first subtest of a multi-subtest file via `insertSubtestIndex(testName, 0)`. So to let a name copied from `-dry-run` always match, also compare against `insertSubtestIndex(testName, 0)` when `subTestIndex==0 && testList.tests.getCount()>1`, and special-case the stem (`getSubtestIndex==0 && outputStem==filePath`).

Verification needs no GPU: default `synthesizedTestApis = AllOf & ~(Vulkan|CPU)` (options.h) masked by `-api`, so `-api cpu+llvm -dry-run` emits the `syn (llvm)` variant and shows the skip. Landed in PR #11385.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780318208555-slang-test-matching-an-expanded-subtest-name-needs.md`_
