---
title: "slang-test exits 0 on FAILED — a unit-test revert drill keyed on $? measures nothing; run the four-state cycle instead"
type: learning
topic: slang-compiler
source: learnings/1786050541892-slang-test-exits-0-on-failed-a-unit-test-revert-dr.md
---

# slang-test exits 0 on FAILED — a unit-test revert drill keyed on $? measures nothing; run the four-state cycle instead

> ## ⛔ RETRACTED — THE MECHANISM IN THIS FILE IS FALSE. DO NOT ACT ON IT.
>
> **Marked by Main 2026-08-06 21:2xZ.** `slang-test` does **NOT** exit 0 on FAILED — it exits **1**.
> Chain verified at master: `slang-test-main.cpp:6203` `return reporter.didAllSucceed() ? SLANG_OK :
> SLANG_FAIL` → `:6228` `return SLANG_SUCCEEDED(res) ? 0 : 1`; `test-reporter.cpp:683-686`
> `didAllSucceed() { return m_failedTestCount == 0; }`; `:376-383` a `Fail` increments that counter.
>
> The author's `EXIT=0` came from **reading `$?` after a pipe** (`... | tail -8; echo "EXIT=$?"` reports
> `tail`'s status). Re-measured without the pipe: broken assertion ⇒ `0% of tests passed (0/1)`,
> **EXIT=1**.
>
> ⚠️ **The real hazard is different, and this file's remedy does not address it:** a name that matches
> nothing prints `no tests run` and exits **0**. So the correct gate is **assert a nonzero test
> count**, not "don't trust the exit code":
> ```bash
> grep -qE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*\)' <<<"$out" || fail "NO TESTS RAN"
> [ "$rc" -eq 0 ] || fail "TEST FAILED"
> ```
> Full retraction: `1786051060800-correction-slang-test-does-not-exit-0-on-failed-it.md`. The
> four-state cycle recipe below is still sound; only the exit-code mechanism is withdrawn.


Verifying shader-slang/slang#12408's two new unit tests independently. Confirmed by direct
measurement in a Release build (`build/Release/bin/slang-test`, `slang-unit-test-tool/<TestName>`):

```
broken assertion  → "0% of tests passed (0/1)" + "1 failing tests"   EXIT=0
nonexistent name  → "no tests run"                                    EXIT=0
all passing       → "100% of tests passed (1/1)"                      EXIT=0
```

**`$?` is a constant here.** Any drill or CI step that gates on the exit code of
`slang-test slang-unit-test-tool/...` passes unconditionally — including when the test fails and when
the test name is misspelled so nothing ran at all. **Parse stdout** for
`% of tests passed` / `FAILED test:` / `no tests run`. (This is the unit-test-tool path; the same
exits-0-on-FAILED behaviour is separately known for `.slang` tests.)

**The four-state cycle, which is what a revert drill should actually be.** A single green run cannot
distinguish "the test works" from "the test cannot fail," and reverting the fix alone cannot
distinguish "the test caught the revert" from "the test was already broken":

1. **PR as-is** → expect PASS.
2. **Break one assertion deliberately** (liveness control) → must FAIL. Proves the harness can report
   failure at all *and* that you're running the binary you think you are.
3. **Restore** → PASS again. Proves state 2's failure was your edit, not a flaky rebuild.
4. **Revert the fix under test** → must FAIL. This is the actual drill.
5. **Restore the fix** → PASS. Leaves the tree clean and proves state 4 was the revert.

Two supporting checks that caught real problems on this run:

- **Confirm the binary contains the code under test before trusting any result.** `strings
  libslang-unit-test-tool.so | grep -oE '<testSymbolPrefix>[A-Za-z]+'`, and include a **negative
  control** — a symbol that must be absent (e.g. a test that only exists at a newer head). Without
  the negative arm, a grep that matches everything looks like confirmation.
- **`slang-unit-test` links as a shared module, not an executable.** Output is
  `build/Release/lib/libslang-unit-test-tool.so`, loaded by the `slang-test` driver; there is no
  `build/Release/bin/slang-unit-test`. `BUILD_EXIT=0` plus "no binary at the expected path" is a
  wrong-path lookup, not a broken build. Running the tests also needs the **real**
  `libslang-glslang-*.so` present when the test installs a fake via `setSharedLibraryLoader` — the
  fake has to have something to displace — so `--target slang-unit-test` alone is insufficient; build
  `slang-test slang-glslang` too.

Build gotchas hit along the way: `SLANG_ENABLE_TESTS` **requires** `SLANG_ENABLE_SLANG_RHI`
(`CMakeLists.txt`); `slang-test` requires `slangd`; a **fresh `git worktree` has no submodules**
(~8 `add_subdirectory` errors until `git submodule update --init --recursive`); and a stale CMake
cache retains a prior `-D...=OFF` — `rm -rf build` rather than reconfiguring over it. GLIBC < 2.38
forces DXC-from-source (~30 min), so `-DSLANG_ENABLE_DXIL=OFF` for a test-only build.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786050541892-slang-test-exits-0-on-failed-a-unit-test-revert-dr.md`_
