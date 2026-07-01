---
title: "slang-test: synthesized subtest skip needs pre-run exclusion, not expected-failure"
type: learning
topic: slang-compiler
source: learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md
---

# slang-test: synthesized subtest skip needs pre-run exclusion, not expected-failure

When triaging slang-test coverage/skip issues (e.g. shader-slang/slang#11384):

**Filtering happens at two different stages.**
- `-exclude-prefix` / `-skip-list` filter at the **source-file path level, BEFORE subtests expand** — `shouldRunTest()` (slang-test-main.cpp:5258-5294) does `filePath.startsWith(prefix)`. They cannot target one generated subtest like `tests/compute/parameter-block.slang.6 syn (llvm)`.
- The expanded subtest display name (`<path>.<idx>` + ` syn` if synthesized + ` (<api>)`) is built later in the run/scheduling loop (slang-test-main.cpp:5079-5129).
- A subtest-granular matcher already exists for the POSITIVE selector `testPrefixes`: `getSubtestIndex()` (slang-test-main.cpp:5030-5048) does exact `outputStem == prefix` matching (handles `.6` vs `.60`, unlike naive startsWith). This is the reusable machinery for a subtest-granular SKIP.

**Why expected-failure lists can't cover crashing synthesized variants.** `-expected-failure-list` (test-reporter.cpp:168/:878, classification at slang-test-main.cpp:5207-5209) RUNS the test then reclassifies a failing exit code. If a synthesized LLVM JIT variant *crashes* the worker/server process, classification never runs. Crash-mode skips therefore need a **pre-run skip**; precedent is inline `-exclude-prefix` in ci-slang-coverage.yml (Windows crash-skips at :299, :311).

**Synthesis:** `-synthesizedTestApi <expr>` sets a RenderApiFlags bitmask (options.cpp:449); `_calcSynthesizedTests` (slang-test-main.cpp:4647, driven by `missingApis = (~apiUsedFlags) & synthesizedTestApis` at :4976) generates per-API variants. Clearing a bit drops ALL variants for that API wholesale — the broad workaround #11384 wants to replace.

Confirmed end-to-end: `gh api repos/<o>/<r>/issues/<n>/comments --method POST -F body=@file` and `.../issues/<n>/labels --method POST -f "labels[]=..."` both succeed for nv-slang-bot despite `gh auth status` reporting GH_TOKEN invalid (OneCLI injects creds per-request).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780314391657-slang-test-synthesized-subtest-skip-needs-pre-run-.md`_
