---
title: "slangpy: calling an already-tagged [shader('compute')] entry point via the functional API segfaults"
type: learning
topic: slang-compiler
source: learnings/1785958438990-slangpy-calling-an-already-tagged-shader-compute-e.md
---

# slangpy: calling an already-tagged [shader("compute")] entry point via the functional API segfaults

Found while scrubbing shader-slang/slangpy#820 (2026-08-05, wheel 0.43.1 == HEAD 507b4cf on all kernel-gen files).

**Symptom:** `mod.my_kernel(spy.grid(...), buf.storage)` hard-segfaults (rc=139) when `my_kernel` carries `[shader("compute")]`. Cross-backend: CUDA **and** Vulkan. 3/3 trials.

**The `[shader("compute")]` attribute alone is the trigger** — not `[numthreads]`, not `SV_DispatchThreadID`. Controlled matrix, same body/signature, tag as the only variable:
| tag | semantic | result |
|---|---|---|
| — | — | OK |
| — | `SV_DispatchThreadID` | OK |
| `[shader("compute")]` | — | **SIGSEGV** |
| `[shader("compute")]`+`[numthreads]` | `SV_DispatchThreadID` | **SIGSEGV** |

**Where it crashes:** NOT kernel gen, NOT compile — both complete. Instrument `slangpy.core.calldata.CallData.__init__` and you'll see it return, and the shader dumps in full under `SLANGPY_PRINT_GENERATED_SHADERS=1`. The crash is at **dispatch**. Cause is a double-entry-point collision: SlangPy unconditionally emits its own `[shader("compute")] void compute_main(… uniform GridArg<3> dispatchThreadID …)` (`generator.py:767-786`, always called from `:928-942`) wrapping a function that is *already* an entry point. Slang also warns `E38040: entry point parameter treated as uniform`. Mechanism (double entry point / uniform-vs-varying) is a hypothesis — no backtrace, so slangpy-vs-slang ownership is unattributed.

**Workaround that works today:** the legacy `.dispatch()` path handles this correctly — `dispatchdata.py:83-86` detects a pre-existing entry point in `module.device_module.entry_points` and reuses it. `mod.tagged_kernel.dispatch(uint3(32,1,1), buffer=buf.storage)` returns correct results. Note epic #768 wants that path retired, so don't build on it.

**Env recipe for probing slangpy without a local build** (saved me a full CMake build): `python3 -m venv /tmp/v && /tmp/v/bin/pip install slangpy numpy`. Gotchas: `python` may not be on PATH (use `python3`); PEP-668 blocks bare `pip install`, hence the venv; `spy.slangpy_path()` does not exist; include paths go through `spy.Device(compiler_options={"include_paths": [...]})` (NOT a top-level `include_paths=` kwarg), pointing at `<site-packages>/slangpy/slang` — otherwise `import "slangpy"` fails with "cannot open file 'slangpy.slang'". Use `faulthandler.enable()` to distinguish a Python exception from a native segfault.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785958438990-slangpy-calling-an-already-tagged-shader-compute-e.md`_
