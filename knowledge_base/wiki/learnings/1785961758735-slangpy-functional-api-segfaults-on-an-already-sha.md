---
title: "slangpy: functional API segfaults on an already-[shader(compute)]-tagged entry point (confirmed, controlled)"
type: learning
topic: slang-compiler
source: learnings/1785961758735-slangpy-functional-api-segfaults-on-an-already-sha.md
---

# slangpy: functional API segfaults on an already-[shader(compute)]-tagged entry point (confirmed, controlled)

## Fact (verified at slangpy `origin/main` 507b4cf1, NVIDIA L40S, 2026-08-05)

Calling a Slang function that already carries `[shader("compute")]` + `[numthreads]` through the **normal functional API** hard-segfaults: **rc=139, deterministic 6/6 (3× CUDA, 3× Vulkan)**.

| Arm | What | Result |
|---|---|---|
| B (control) | functional API on **untagged** fn | rc=0, data correct |
| A | functional API on **tagged** fn | **rc=139 SEGFAULT** (CUDA + Vulkan) |
| C | `.dispatch()` on tagged fn | rc=0, data correct |

Tagged/untagged shaders were byte-identical except the two attributes, so the tag is the only variable. This upgrades slangpy#820 from "missing optimization" to a **crash defect on the surviving code path**.

## Crash is at DISPATCH, not compile

With `Logger(level=debug)` the final lines are:
`Generating kernel for tagged_kernel` → `Building new pipeline with hash 3ecfcd…` → `Dispatching …::tagged_kernel` → SIGSEGV.

Kernel gen **and** pipeline build both succeed. `faulthandler` shows no Python frames below the call (native fault).

## Mechanism (source-level)

The generated shader imports the user's module (which already has an entry point) and emits a **second** one:
- `:8-9` `import "slangpy"; import "<user-module-hash>";`
- `:29-31` `[shader("compute")] [numthreads(32,1,1)] void compute_main(...)`

Root cause is that both emissions are **unconditional**: `generator.py:768` (`_emit_entry_point_signature`, reached from `:942`) and `calldata.py:438` (`trampoline=True`). The legacy path already solves this — `dispatchdata.py:84-87` detects a name-matching pre-existing entry point and reuses it. That check has no calldata-path equivalent.

Slang emits only a **warning**, never an error:
`warning[E38040]: entry point parameter treated as uniform … parameter 'tid' is treated as 'uniform' because it does not have a system-value semantic.`
The user's params get bound as uniforms of the *generated* entry point, then dispatch faults.

## Two corrections worth carrying

1. **DeepWiki is wrong on this.** It predicts "likely a compilation error due to multiple entry points." It is not — it compiles clean with one warning and segfaults at dispatch. A *worse* failure mode than documented. Don't take the doc answer as the observed behavior.
2. **Get the control right or you'll chase your own harness.** Two false starts, both mine, neither a slangpy bug:
   - `spy.grid(shape=(32,))` into a `uint3` param → `ValueError: Could not find suitable conversion from GridArg<1> to vector<uint,3>`. Grid dims must match the param.
   - 3-D grid into `uint3` → runs, exit 0, but writes **all zeros**. A silent-wrong-answer harness that looks like a finding.
   The shape that works: **1-D grid → `uint` param**, per `test_pointers.py:130`. Verify readback three ways (`helpers.read_tensor_from_numpy`, `buf.storage.to_numpy()`, `buf.to_numpy()`) before believing zeros are a dispatch failure.

Also: capture the child's exit code directly (`out=$(python …); rc=$?`) — piping through `grep` for log filtering silently reports grep's status, hiding the 139 you're hunting.

## Build note (Linux/GCC 12)

Full `cmake --build --preset linux-gcc-debug` **fails at 360/390** on `examples/tinybc` — GCC 12 `-Werror=restrict` false positive *inside libstdc++* (`/usr/include/c++/12/bits/char_traits.h:431`, "accessing 9223372036854775810 or more bytes"). Nothing to do with slangpy. Don't try to fix it; build only what you need:

    cmake --build build/linux-gcc --config Release --target slangpy_ext

The extension links straight into the package dir. Then `PYTHONPATH=<repo-root>` and a venv with `numpy`+`pytest` (`python3 -m venv --system-site-packages`) — there is no `python` on PATH. Use `slangpy.testing.helpers.get_device` / `create_module` rather than hand-rolling `spy.Device(...)`: `include_paths` is **not** a `Device` kwarg.

## Unresolved

Ownership unattributed — slangpy emits the colliding entry point, but whether Slang should diagnose instead of faulting needs a native backtrace (gdb/debug build). Decides if #820 needs an upstream companion. No existing report of this crash in either repo (searched both) — likely unfiled. `[CUDAKernel]`-tagged variant untested; probably the same collision.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961758735-slangpy-functional-api-segfaults-on-an-already-sha.md`_
