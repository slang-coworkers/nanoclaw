---
title: "Target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it"
type: learning
topic: misc
source: learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md
---

# Target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790092897972-cuygfq
written_at: 2026-09-23T02:41:09.708Z
---

# Target-gating an emitted-code optimization: CPU-via-LLVM uses a separate emitter — exclude it

When you gate an **emitted-code** optimization on a Slang target predicate (e.g. "this target can express an `unreachable` terminator, so prune the dead arm"), remember there are **two independent CPU emission paths** and they do not share a prelude:

- **C-family source emission** (`cpp`/`host-cpp`/`torch`, and CUDA) goes through the shared C-like emitter (`emitRegion` in `slang-emit-c-like.cpp`) and picks up macros from the text preludes (`slang-cpp-types-core.h`, `slang-cuda-prelude.h`). This is where a `SLANG_PRELUDE_UNREACHABLE()`-style macro (debug-trap / release-no-return) lives.
- **CPU via the LLVM backend** goes through `slang-emit-llvm.cpp` (`emitLLVMForEntryPoints`), which maps `kIROp_Unreachable` → `CreateUnreachable()` = a **raw, trap-less LLVM `unreachable`**. It never touches the C-like emitter or any text prelude, so it gets **no debug trap**.

Consequence: a predicate like `isCUDATarget || isCPUTarget` is too broad for the *producer* side — it would let the LLVM-CPU path convert a defined default into untrapped UB. Fix: give the predicate a `TargetRequest*` overload that additionally excludes `isCPUTargetViaLLVM` (`slang-code-gen.cpp`), and keep the LLVM path's defined default. The `CodeGenTarget` overload can't see the LLVM-vs-source distinction, so it should be consulted **only** by the C-like emitter (which never runs for LLVM).

Why the split is gap-free by construction: the **same** `isCPUTargetViaLLVM` predicate drives both (a) the producer's choice via the `TargetRequest*` overload and (b) the LLVM-vs-source emitter routing. So on the LLVM path the producer keeps the default AND the C-like emitter never runs (no stranded marker); on a source path, producer-emits-unreachable ⟺ emitter-emits-marker. Verify each overload has exactly one caller when you rely on this.

Also: `isCUDATarget` covers `CUDASource`/`CUDAHeader`/`PTX` but **not** `CUDAObjectCode` — self-consistent (both producer and emitter skip the marker), at most a missed optimization on that payload, never a correctness bug.

Context: shader-slang/slang#13220 / PR #13228, `doesTargetSupportUnreachableTerminator`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790131269708-target-gating-an-emitted-code-optimization-cpu-via.md`_
