---
title: "slangpy Vulkan 'xdist worker crashed, no traceback' can be a catchable Slang SPIRV-Tools assert (compile-time), not a driver/GPU bug"
type: learning
topic: slang-compiler
source: learnings/1790126928369-slangpy-vulkan-xdist-worker-crashed-no-traceback-c.md
superseded_by: 1790127518160-slangpy-1181-correction-the-vulkan-worker-crash-is
---

# slangpy Vulkan "xdist worker crashed, no traceback" can be a catchable Slang SPIRV-Tools assert (compile-time), not a driver/GPU bug

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1790106628057-vblupb
written_at: 2026-09-23T01:28:48.369Z
---

# slangpy Vulkan "xdist worker crashed, no traceback" can be a catchable Slang SPIRV-Tools assert (compile-time), not a driver/GPU bug

Case: shader-slang/slangpy#1181 — nightly `ci-latest-slang` reported a "deterministic" native Vulkan worker crash in `test_differentiable_interface_parameters[vulkan]` under pytest-xdist, CUDA variant passing, no Python traceback, and **no crashpad dump**. The issue's own triage concluded it was likely an *environmental Vulkan driver/ICD change* and an *uncatchable SIGKILL/GPU-hang* that "no code could capture."

Both conclusions were WRONG. Root cause, caught locally:

- It is a plain **SIGABRT (rc=134)** from a C++ `assert()`, fully catchable under gdb. It went undumped in CI only because it fired inside an **xdist worker** (process aborts before crashpad correlates the dump). Running the single test with **`-p no:xdist`** lands the abort in the controller.
- It is **intermittent (~25% per isolated run)**, not deterministic — xdist's many parallel shader compiles + memory pressure amplify it to ~100% across a 4352-test run, which *looked* deterministic.
- The abort is **compile-time**, in Slang's bundled SPIRV-Tools optimizer — zero GPU/driver frames:
  `spirv-tools/source/opt/instruction.h:251: Instruction::unique_id(): Assertion 'unique_id_ != 0' failed`, in `MergeReturnPass::BranchToBlock` → `DefUseManager::EraseUseRecordsOfOperandIds` → `UserEntryLess` comparator dereferencing a **cleared/zeroed instruction still referenced in the def-use std::set** (use-after-free/ordering hazard → the nondeterminism). Reached via `glslang_optimizeSPIRV` → Slang `GlslangDownstreamCompiler::_invoke` → `emitSPIRVForEntryPointsDirectly` → slang-rhi `compileShaders` → `NativeCallData::exec`.
- **Vulkan-only / CUDA-passes is fully explained:** only the SPIR-V target runs glslang+SPIRV-Tools; CUDA emits C++/PTX and never runs `MergeReturnPass`. So it's a **Slang SPIR-V codegen/optimization bug** (here on the `bwd_diff`-through-`interface`/`IDiffTensor` path), cross-file it on shader-slang/slang.

Reusable playbook for "slangpy xdist worker crashed, no traceback, Vulkan-only":
1. Don't assume driver/GPU/xdist-only. Build fresh + run the ONE test `--device-types vulkan -p no:xdist`, looped, until it aborts (rc=134/139).
2. Wrap in `gdb --batch -ex run -ex bt --args python -m pytest ...` — a SIGABRT/SIGSEGV yields a full native stack even when crashpad produced nothing.
3. "No crashpad dump" ≠ uncatchable signal; a worker-side abort just isn't correlated. Check the signal number before concluding SIGKILL/watchdog.
4. If the stack is in `spvtools::opt::*` / `glslang_*` / `emitSPIRV*`, it's a Slang compiler crash, not slangpy/rhi/driver.

Build notes (fleet): reused project venv can be missing `libcst` (in requirements-dev.txt) → slangpy build "fails" only at the `.pyi` stub-gen step while the runtime `.so` is already built; `pip install libcst` + incremental `cmake --build` finishes. Slang master Debug built in ~4 min on 64 cores; the fleet L40S box does have a working NVIDIA Vulkan ICD (api 1.4.329).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790126928369-slangpy-vulkan-xdist-worker-crashed-no-traceback-c.md`_
