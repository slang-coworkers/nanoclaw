---
title: "Run filecheck .slang tests through real slang-test (copy libslang-llvm.so), never a simulator"
type: learning
topic: slang-compiler
source: learnings/1784743223082-run-filecheck-slang-tests-through-real-slang-test-.md
---

# Run filecheck .slang tests through real slang-test (copy libslang-llvm.so), never a simulator

## Problem
For `//TEST:SIMPLE(filecheck=...)` tests, the local env often has no FileCheck, so `slang-test`
reports the test as **"ignored"** (0/0, 2 ignored), not passed. Tempting shortcut: verify CHECK lines
with `slangc ... | grep` or a hand-rolled ordered/DAG matcher. This is UNRELIABLE — a reviewer
(shader-slang/slang#12170) asked "does it pass through slang-test?" and a Python FileCheck simulator
that PASSED turned out to FAIL under real FileCheck (backreference/scan semantics differ).

## Fix — make slang-test actually run FileCheck
slang-test loads FileCheck from `libslang-llvm.so` via `createLLVMFileCheck_V1`
(`TestContext::locateLLVMFileCheck`, tools/slang-test/test-context.cpp). The DEFAULT cmake build
SKIPS LLVM ("built without LLVM support") when git tags are missing, so the lib isn't produced.

1. Copy a prebuilt one from the shared base clone (read-only shared resource; do NOT touch sibling
   worktrees):
   `cp /workspace/agent/slang/build/Debug/lib/libslang-llvm.so <your-worktree>/build/Debug/lib/`
   FileCheck V1 is target-independent LLVM FileCheck, so version drift between the lib and your
   slangc does NOT matter for FileCheck.
2. Run: `LD_LIBRARY_PATH=build/Debug/lib ./build/Debug/bin/slang-test tests/path/to/test.slang`
   Now it reports "Supported: ... llvm" and actually runs FileCheck (100% passed vs "ignored").

## Second gotcha — derive SPIR-V CHECKs from -O0, not -target spirv-asm
SIMPLE `-target spirv` tests run at **-O0**. At -O0 a value roundtrips through the local variable
(e.g. `OpStore %v.position %loaded` then reload+`OpCompositeExtract`+`OpStore %output %extracted`),
whereas `slangc -target spirv-asm` applies folding and emits a direct `OpStore %output %loaded`.
So a capture chain derived from `-target spirv-asm` (loaded==stored) will NOT match the real -O0
output. Build a real -O0 binary and disassemble with a locally-built spirv-dis:
`cmake --build --preset debug --target spirv-dis` →
`build/external/spirv-tools/tools/Debug/spirv-dis build/out.spv`, and write CHECKs against THAT.

## Bar
If a reviewer might run the test through slang-test, YOU run it through slang-test first — with the
copied libslang-llvm.so — before claiming it passes.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784743223082-run-filecheck-slang-tests-through-real-slang-test-.md`_
