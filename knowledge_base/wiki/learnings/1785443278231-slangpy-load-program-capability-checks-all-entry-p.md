---
title: "SlangPy load_program capability-checks ALL entry points in a module at load (not lazy-per-function)"
type: learning
topic: slang-compiler
source: learnings/1785443278231-slangpy-load-program-capability-checks-all-entry-p.md
---

# SlangPy load_program capability-checks ALL entry points in a module at load (not lazy-per-function)

**Fact (empirically confirmed, refutes a common assumption):** When SlangPy loads a `.slang` module via `device.load_program("mod.slang", ["one_entry_point"])`, Slang's front-end **capability-checks every `[shader]` entry point in the module at load time**, not just the one you named. If ANY entry point in the file is unsupported for the target, the WHOLE module load fails.

**Evidence:** slangpy CI run 30564544350 — `test_buffer[128-byte_address_buffer-DeviceType.cuda]` called `load_program("test_buffer.slang", ["copy_byte_address_buffer"])` (a CUDA-clean entry point) but failed with `SlangCompileError: Failed to load slang module "test_buffer.slang"` → `error[E36107]: entrypoint 'copy_buffer_uint' uses features not available for 'cuda'` → `E39999: import failed` → `E40003: compilation ceased`. Requesting one EP tripped an error on a *sibling* EP it never asked for.

**Why it matters / how to apply:**
- DeepWiki (shader-slang/slangpy) claims loading is "lazy per-function" — this is WRONG for the `load_program` path. Trust CI logs over DeepWiki here.
- Consequence: co-locating multiple compute entry points in one test `.slang` is fragile — one target-unsupported EP takes down its CUDA/Metal/Vulkan-clean siblings via collateral module-load failure.
- **Fix pattern (idiomatic, verified):** guard the unsupported entry point's WHOLE declaration with the target macro, e.g. `#ifndef __TARGET_CUDA__ ... #endif`. SGL injects `__TARGET_CUDA__` (and `__TARGET_D3D12__/VULKAN__/METAL__/WGPU__/CPU__`) as a session macro per target at `src/sgl/device/shader.cpp:486-496`, and the preprocessor runs BEFORE the front-end capability check — so the guarded EP never reaches E36107 on that target. In-repo precedent: `src/sgl/device/blit.slang:61-86` wraps whole `[shader]` decls this way; `test_print.slang` uses the same macro family for statement-level exclusion.
- E36107 ("uses features not available for '<target>'") is a front-end capability check (checkEntryPointShaderAttributes), distinct from NVRTC/PTX backend codegen which is deferred to first dispatch. The preprocessor exclusion beats both.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785443278231-slangpy-load-program-capability-checks-all-entry-p.md`_
