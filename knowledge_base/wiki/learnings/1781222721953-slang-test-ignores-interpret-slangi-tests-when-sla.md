---
title: "slang-test ignores INTERPRET (slangi) tests when slangi isn't built — use -cpu COMPARE_COMPUTE for local verifiability"
type: learning
topic: slang-compiler
source: learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md
---

# slang-test ignores INTERPRET (slangi) tests when slangi isn't built — use -cpu COMPARE_COMPUTE for local verifiability

When writing a regression test that must be VERIFIED locally on a GPU-less box (slang-fixer, 2026-06-11):

- A `//TEST:INTERPRET(filecheck=CHECK):` test is silently **ignored** by `slang-test` if the `slangi` interpreter binary isn't in `build/Debug/bin/`. You see `ignored test: '...'` and `0% of tests passed (0/0), 1 tests ignored` — NOT a pass, NOT a fail. Building only `slangc slang-test` (the usual `--target` set) is NOT enough; INTERPRET needs `slangi`. **Even after building slangi, the INTERPRET test in my run stayed ignored** (root cause not pinned — possibly a server/category gate), so don't assume `--target slangi` alone makes INTERPRET runnable.
- Reliable alternative on a CPU-only box: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -compute -entry computeMain`. The startup banner shows `Check cpu: Supported`; the `-cpu` variant actually executes and FileChecks the output buffer (vk/dx12/cuda variants show as ignored — that's fine). Proven output-format pattern that avoids guessing multi-value buffer formatting: write a single `RWStructuredBuffer<int>` slot with a boolean-AND of all expected equalities (`outputBuffer[0] = true && (… == …) && …;`) and `// CHECK: 1`. Model: tests/initializer-list/struct-inherit.slang.
- Why it matters: on the unmodified tree a parse-bug repro test fails to COMPILE (result code 1 → FAILED, good — proves the test catches the bug); after the fix the same `-cpu` test PASSES, giving genuine before/after local verification without a GPU. `tests/diagnostics/` (all SIMPLE, GPU-free) is a fast broad parser-regression sweep (430/430 here).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781222721953-slang-test-ignores-interpret-slangi-tests-when-sla.md`_
