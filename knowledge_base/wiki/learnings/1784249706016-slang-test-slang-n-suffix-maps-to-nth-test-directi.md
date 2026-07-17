---
title: "slang-test .slang.N suffix maps to Nth TEST directive — don't call a numbered sub-test a 'GPU flake' without checking which entrypoint/CHECK-prefix it is"
type: learning
topic: slang-compiler
source: learnings/1784249706016-slang-test-slang-n-suffix-maps-to-nth-test-directi.md
---

# slang-test .slang.N suffix maps to Nth TEST directive — don't call a numbered sub-test a "GPU flake" without checking which entrypoint/CHECK-prefix it is

**Rule:** `slang-test` names the FIRST `//TEST:` directive `foo.slang` and suffixes the rest `foo.slang.1`, `foo.slang.2`, ... **by directive order in the file**. So `foo.slang.1` is the *second* directive, not "whichever one looks GPU-ish." Before dismissing a numbered sub-test as flaky, map the number to its actual directive: read the entrypoint (`-entry X`), target (`-target spirv-asm` = deterministic codegen; `COMPARE_COMPUTE`/`-vk` = runtime/GPU), and CHECK prefix.

**Why it bit us (slang#11595, gh-9931.slang, 3 sessions):** `gh-9931.slang` has 3 directives: `[0]` `computeMain` spirv-asm (base name), `[1]` `computeMainNV` spirv-asm `-DNV_HANDLE` (`.slang.1`), `[2]` COMPARE_COMPUTE `-vk` (`.slang.2 (vk)`). I repeatedly wrote off `gh-9931.slang.1` as "NV CHECK_NV-DAG GPU-runner nondeterminism" — but `.1` is a **deterministic spirv-asm codegen** test (`SIMPLE(filecheck=CHECK_NV)`), which can NEVER be nondeterministic. It was a real regression: our new E41303 alignment diagnostic aborted compilation on that entrypoint's `Store<8-byte-type>(4, h, 8)` (`4 % 8 ≠ 0`), emitting empty SPIR-V so the CHECK_NV assertions matched nothing. A maintainer had to point it out.

**How to apply:**
- A `SIMPLE`/spirv-asm/DIAGNOSTIC sub-test failing on CI is deterministic — reproduce it with `slangc` on the RIGHT entrypoint, or just run `slang-test <file>` (it prints `passed test: 'X.slang.N'` / `FAILED test:` per sub-test). Only `COMPARE_COMPUTE`/`-vk`/`-cuda` runtime sub-tests can be genuinely GPU-nondeterministic.
- When hand-grepping a repro, confirm you're compiling the entrypoint that the failing sub-test index maps to — I first grepped `computeMain` (`.slang`, which PASSED) and saw green, masking the `computeMainNV` (`.1`) failure.
- FileCheck presence varies by runner: if `slang-test` prints a real `FAILED test:` line locally, FileCheck IS installed and the run is authoritative — trust it over a manual grep of the wrong entrypoint.
- "Recurring on CI, green on master, not in my diff" is NOT sufficient to call flake when the sub-test is deterministic AND your PR added a diagnostic that could abort that exact code path. Check whether your change makes the previously-passing input now error.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784249706016-slang-test-slang-n-suffix-maps-to-nth-test-directi.md`_
