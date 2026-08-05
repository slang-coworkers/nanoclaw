---
name: project-9736-cuda-atomic-conflict-nonstatic-device-funcs
description: "slang#9736 — CUDA prelude global atomic overloads collide with PyTorch ATen; generated __device__ funcs get external linkage. MEASURED and CONFIRMED by slang-triager with nvcc 12.6 (my 'repro not executed' was WRONG — slangc and nvcc were both present); posted as cmt 5176126183, awaiting mkeshavaNV."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5998cff2-0986-4076-bf33-eb6d163a5534
---

# slang#9736 — CUDA atomic conflicts + non-inline generated device funcs

Filed 2026-01-26 by **wilsonCernWq**. Assignee **mkeshavaNV**, milestone Q1 2026,
**0 comments** → ~6 months stale at 2026-08-04. Triaged by me 08-04.
Verified against local clone HEAD `0864e60e635ef39d4c25e5e57747d909f1c05edd`.

Use case: compile *individual* Slang functions to CUDA, `#include` them from an
existing hand-written CUDA/gsplat codebase (wants autodiff for a few device
functions, not a full kernel port).

## Defect 1 — atomic overload collision (CONFIRMED, source-read)

`prelude/slang-cuda-prelude.h` injects 4 atomic overloads at **global scope**:

- `:2719` `__device__ __forceinline__ longlong atomicExch(longlong*, longlong)`
- `:2724` `__device__ __forceinline__ longlong atomicCAS(longlong*, longlong, longlong)`
- `:2732` `__device__ __forceinline__ longlong atomicAdd(longlong*, longlong)`
- `:2739` `__device__ __forceinline__ float atomicCAS(float*, float, float)`

`longlong` is `typedef int64_t longlong` on non-NVRTC (`:306`).
PyTorch `ATen/cuda/Atomic.cuh` (~`:231`, fetched from pytorch `main` 08-04) has
`inline __device__ void atomicAdd(int64_t*, int64_t)` — **`void`** return.

⇒ same signature, return type differs only ⇒ nvcc *"cannot overload functions
distinguished by return type alone"*. Matches reporter's Error 1 exactly.
**No namespace anywhere in the CUDA prelude** (only `namespace Slang` in the
emitter `.cpp`, not the emitted/included prelude).

## Defect 2 — external linkage on generated `__device__` funcs (CONFIRMED)

⭐ **The `static` logic EXISTS but CUDA deliberately routes around it.**

- `slang-emit-cpp.cpp:956` `isPublicOrExportedFunc(IRFunc*)`
- `slang-emit-cpp.cpp:993-996` — `if (!isPublicOrExportedFunc(func)) emit("static ")`
- **BUT** `slang-emit-cuda.cpp:1521-1525` `CUDASourceEmitter::emitSimpleFuncImpl`
  *"Skip the CPP impl"* → calls `CLikeSourceEmitter::emitSimpleFuncImpl` directly,
  and the CLike path emits **no linkage specifier at all**.
  Control-verified: 0 `emit("static` in that 60-line window, 2 in the whole file
  ⇒ the zero is a real absence, not a broken grep.

⇒ every generated `__device__` helper has **external linkage** ⇒ same `.cuh` in
2 TUs = duplicate symbol. Reporter's `unpackAnyValue8_0` link error.

## Defect 3 — "ForceInline ignored" is mis-stated but the complaint is real

`unpackAnyValue8_0` is **compiler-synthesized**, not user code:
`slang-ir-any-value-marshalling.cpp:1144-1154` (`generateUnpackingFunc`, name
built at `:1153`; pack at `:734`). The user **cannot** annotate it — so
*"adding [ForceInline] to every slang function cannot fix this"* is correct as
observed, but the cause is unreachability, not a dropped decoration.
Control-verified: **zero** inline/ForceInline decorations added anywhere in that
file (controls: 1390 lines readable, 3 `addNameHintDecoration` hits, 11 `Inline`
hits in sibling `slang-ir-lower-buffer-element-type.cpp` ⇒ instrument works).
Pass order: `generateAnyValueMarshallingFunctions` `slang-emit.cpp:1659` runs
*before* `performForceInlining` `:1698` — decoration never added ⇒ never inlined away.

## ⭐ REFRAME — `-target cuh` already exists and is INCOMPLETE

Not a missing feature; an **unfinished existing one**.
- `slang-options.cpp:421` → `{"cuh", "CUDA Header"}`; `CodeGenTarget::CUDAHeader`
- golden test `tests/headers/generate-cuh-header.slang`
- emits `#pragma once` via `shouldEmitOnlyHeader()` `slang-emit-c-like.cpp:124-131`

`#pragma once` guards **double-inclusion within one TU** and does **nothing** for
multiple-definition **across TUs**. So the header target ships for exactly this
workflow yet cannot be used multi-TU. Sharpest framing for the maintainer.

Existing vocabulary a fix should reuse: `[CudaDeviceExport]` / `[CUDADeviceExport]`
(`core.meta.slang:4803,4818`) is already in `isPublicOrExportedFunc`'s allowlist
⇒ non-exported → internal linkage, exported → external, is the principled shape.

## ✅ MEASURED by slang-triager — my "cannot reproduce" was WRONG

⛔ **RETRACTED (2026-08-04): "Repro NOT executed — no built `slangc`, no `torch`."**
Both errors are **compile/link-time**; neither needs a GPU or `torch`.
- `nvcc` **12.6 IS installed** at `/usr/local/cuda/bin/nvcc` — I never probed it,
  I inferred its absence from `torch` being absent (a non-sequitur).
- `slangc` **existed in MY OWN tree** at `slang/build/Release/bin/slangc` (+9 more
  under peer `/workspace/extra/ephemeral/prod-groups/*/`). My probe was two
  **guessed relative paths from the wrong cwd**. See
  [[feedback-capability-negative-needs-a-search-not-two-guesses]].

**Triager's measurements (nvcc 12.6, 5 configs incl. 1 A/B control + 2 counterfactuals):**
- **Error 1 CONFIRMED**: ATen-shaped `void atomicAdd(int64_t*,int64_t)` before HEAD's
  prelude ⇒ `slang-cuda-prelude.h(2732): error: cannot overload functions
  distinguished by return type alone` — reporter's error verbatim.
- **Error 2 CONFIRMED + A/B**: same source `-target cpp` ⇒ `static float Scale_eval_0`;
  `-target cuda` ⇒ **no specifier**. 2 TUs ⇒ `nvlink error : Multiple definition of
  '_Z12Scale_eval_0P7Scale_0f'`.
- ⭐⭐**COUNTERFACTUAL FINDING my source read MISSED**: adding `static` to non-exported
  helpers fixes those, but **`exportedEntry` still collides** — correctly, it IS
  exported ⇒ **internal linkage is NECESSARY BUT NOT SUFFICIENT** for a header
  carrying definitions.
- ⭐⭐**Two shapes ALREADY LINK today (`LINK EXIT=0`)**: (i) `-target cuh` emits
  **declarations only** ⇒ cuh in N TUs + one `-target cuda` definition TU, `-dc`;
  (ii) header-only, once every func has internal linkage, no `-rdc`. Strengthens the
  reframe from "unfinished feature" to **"two coherent supported shapes already exist."**
- Stale-binary trap **discriminated, not discarded**: that `slangc` is `3649fb982`
  (82 commits behind) but `git diff … | grep -E 'isPublicOrExportedFunc|static "'`
  = **empty** ⇒ valid instrument for the linkage claim specifically.

## ⚠️ Corrections to my briefing (both verified by me 08-04)

1. ⛔**"No namespace anywhere in the CUDA prelude" was WRONG** — `Slang_CUDA_WMMA`
   at `slang-cuda-prelude.h:6649`. Unrelated/local so the *point* stands (atomics are
   ungrouped), but the absolute phrasing would not survive a maintainer's grep. I had
   grepped the **emitter `.cpp`** and stated a conclusion about the **prelude header**.
2. **Pass ordering is NOT the cause.** `performForceInlining` also sits at
   `slang-emit.cpp:1667`, inside the `HostVM` early-return (`:1665-1670`), so `:1698`
   is the live one for CUDA and 1659 < 1698 ⇒ marshalling funcs **do** exist when
   force-inlining runs. The cause is the **missing decoration** (`grep -c` = 0), not order.

## ⭐ Precedent for option (a) — found by triager, verified by me

`SLANG_PRELUDE_NAMESPACE` is an established **opt-in** guard: `slang-cpp-types.h:4-5`,
emitted at `slang-emit-cpp.cpp:1915-1916`. **`prelude/slang-torch-prelude.h:52` — the
PyTorch-facing prelude — already defines it**, while including `ATen/cuda/CUDAContext.h`
(`:7`). CUDA prelude has **0** occurrences (control: `slang-cpp-types.h` = 1).
⇒ a guarded, non-breaking-by-default spelling is existing Slang vocabulary for exactly
this collision class ⇒ (a) is far less risky than "namespace the atomics" sounds.

## ⚠️ Still standing

- **Shallow clone (`depth 1`).** An early `git log -S` returned only HEAD ⇒ **no
  history/regression claim.** Do not assert when this was introduced.
- PyTorch signature is from `main` **today**, not the reporter's build. The
  void-vs-`longlong` *mechanism* is version-robust; the line number is not.

## Verdict / routing

Subsystem **CUDA backend — prelude + emit** (+ `cuh` target completeness).
NOT autodiff (autodiff only surfaces it via AnyValue marshalling).
Severity **P2**: no miscompile/crash, but hard-blocks the documented `cuh`
workflow; 100% reproducible; hits anyone pairing Slang-CUDA with PyTorch/ATen.
Manual workaround (hand-edit generated header) exists but must be redone on every
regenerate. Fix is **design-gated** — namespacing global atomics is potentially
source-breaking for existing CUDA consumers ⇒ maintainer call, **no fixer dispatched**
(human assignee mkeshavaNV, per the #8306 precedent).

✅**POSTED 08-04 — cmt `5176126183`** by triager (`nv-slang-bot[bot]`, 4947 chars,
`comments=1` not stacked); `reproduced` label applied; Type already `Bug`.
Recommended **(b) first** (lowest risk, root-caused at the bypass, reference impl
already exists at `slang-emit-cpp.cpp:993`); **(a)** is the design-gated half.

**RESUME** = mkeshavaNV (or another maintainer) picks (a) namespace/guard the prelude
atomic overloads / (b) internal linkage for non-exported generated `__device__` funcs /
(c) both, scoped to `-target cuh`. ⚠️A **maintainer** direction call is the trigger — a
non-bot comment on the issue. No fixer (design gate + human assignee, #8306 precedent).

Related: [[feedback_control_the_instrument_not_the_reasoning]] (controls used
throughout), [[project-8306-embed-core-glsl-module-slang-dll]] (assignee-is-human
⇒ no fixer precedent).
