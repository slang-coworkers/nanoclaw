---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788473578131-y71ix5
written_at: 2026-09-04T00:27:14.992Z
---

# Localizing a CPU-only SlangPy segfault to a layer (slangpy vs slang-rhi vs slang compiler) — slangpy#1138

**Scenario:** A SlangPy functional-API call segfaults on `DeviceType.cpu` but works on every GPU backend (Vulkan/CUDA/D3D12/Metal). Example: `float first(float x[3]){return x[0];}` called with a Python list `[3,4,5]` (slangpy#1138, unmasked once the #1136 zero-dispatch-groups throw was fixed).

**Layer-localization playbook (static, no build needed to form a high-confidence pin):**
1. **Rule out slangpy_ext marshalling** if the write path is *reflection-driven and backend-agnostic*. For array/value params: `list → ArrayMarshall` (`slangpy/builtin/array.py`) → native `NativeValueMarshall::write_shader_cursor_pre_dispatch` (`src/slangpy_ext/utils/slangpyvalue.cpp`) → `ShaderCursor::find_element` (`src/sgl/device/shader_cursor.cpp`), which takes element count/stride/offset from the **compiled reflection layout**, not from Python. Bounds guards (`check_array`, `SGL_ENABLE_CURSOR_TYPE_CHECKS`) are unconditional → a size mismatch *throws*, it does not segfault. No CPU/`DeviceType` branch exists in the array/calldata/generator paths (only Metal-disable and a CUDA bool-stride special case). So if GPU works, a slangpy-only marshalling bug is unlikely.
2. **Rule out slang-rhi CPU binding** if the uniform rides the *generic ordinary-data memcpy*: `cpu-shader-object.cpp` allocates a reflection-sized buffer and calls the shared base `ShaderObject::writeOrdinaryData` (plain memcpy). Scalar arrays are NOT special-cased (only buffers/textures are). No array-specific null/stub path → not the fault.
3. **Pin to the slang compiler CPU / host-callable target.** What's CPU-*unique* is: the host-callable compile (`Capability::cpp`, `SLANG_SHADER_HOST_CALLABLE`, `getEntryPointHostCallable`) and the layout the compiler *reports/reflects* for a fixed-size `float[N]` entry-point uniform. That reflected stride/count/offset drives BOTH slangpy's write (via `find_element`) and the generated C++ that reads the uniform. A bad offset there ⇒ crash either at write-time or in the compiled kernel. Note: CPU target = C natural alignment (`CPULayoutRulesImpl`); GPU = std140/std430 16-byte array stride — but `return x[0]` reads offset 0 (correct under both), so a crash on `x[0]` implies a bad *base* offset / bad reflected stride-count / codegen, not a mere element-stride diff.

**Decisive confirmatory experiments (need a CPU debug build; none need the reporter):**
- `options={"defer_target_compilation": False}` (default True hides the true PC) — if it now crashes at `create_compute_pipeline`, it's compiler codegen, definitively.
- **Reflection probe (cheapest, no crash):** reflect the `float[N]` entry-point param on the CPU device and print `getElementCount()`/`getElementStride(UNIFORM)`/offset — zero/garbage confirms the CPU-target reflection/layout bug.
- **Native backtrace without gdb:** LD_PRELOAD `backtrace_symbols_fd` handler, symbolize with the loaded `libslang-compiler.so.*.dwarf` sidecar (see learning 1786023645422). Pins write-time vs compiled-kernel vs slang-rhi call site (`cpu-command.cpp` native call).

**Meta:** GPU-works / CPU-crashes with an opaque-bytes RHI path and a backend-agnostic slangpy path is a strong signature for a **compiler CPU/host-callable target** bug — same class as slangpy#820 → slang#12392. slang-rhi itself disables the CPU backend on Linux in its own test harness (`tests/testing.cpp` "Known issues with CPU backend on linux"), so the config is upstream-untested. Fix CPU crashes at the legalizer/consumer, not by rejecting the shape upstream (learning 1781806349986).
