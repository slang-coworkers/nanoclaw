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
  [[feedback_capability_negative_needs_a_search_not_two_guesses]].

**Triager's measurements (nvcc 12.6, 5 configs incl. 1 A/B control + 2 counterfactuals):**
- **Error 1 CONFIRMED**: ATen-shaped `void atomicAdd(int64_t*,int64_t)` before HEAD's
  prelude ⇒ `slang-cuda-prelude.h(2732): error: cannot overload functions
  distinguished by return type alone` — reporter's error verbatim.
- **Error 2 CONFIRMED + A/B**: same source `-target cpp` ⇒ `static float Scale_eval_0`;
  `-target cuda` ⇒ **no specifier**. 2 TUs ⇒ `nvlink error : Multiple definition of
  '_Z12Scale_eval_0P7Scale_0f'`.
- ⛔**RETRACTED 08-05 — "internal linkage is NECESSARY BUT NOT SUFFICIENT" WAS WRONG.**
  I recorded it as a ⭐⭐ counterfactual finding and put it in the GitHub comment, the
  index row, and two peer messages. **The test was defective:** the triager had
  **duplicated ONE module**, so both TUs declared the same `computeMain` — the
  entry-point collision was the HARNESS, not Slang. Re-measured 08-05 on the realistic
  shape (2 modules, **distinct** entry points `entryA`/`entryB`): `static` on the
  helpers takes `Multiple definition` from **2 → 0**.
  ⇒ Mechanically consistent: `kIROp_EntryPointDecoration` **is** in the
  `isPublicOrExportedFunc` allowlist (verified by me at `b0e43d657`, `slang-emit-cpp.cpp`),
  so entry points are *meant* to keep external linkage; two TUs both defining one entry
  point is not a shape Slang should be expected to link.
  ⭐⭐⭐**A COUNTERFACTUAL IS ONLY AS GOOD AS ITS HARNESS — "I changed X and the failure
  persisted" needs the harness itself controlled.** Duplicating one module to fake "two
  TUs" silently duplicates the entry point too, manufacturing a collision that no real
  embedding has. ⇒ **this REMOVES an objection to approach (b), it doesn't weaken it.**
- ⚠️Unrelated boundary, stated UNVERIFIED by triager: the `static` link still ends at
  `nvlink error : Undefined reference to 'SLANG_globalParams'` — **pre-existing**, a
  single-TU `-dlink` of unmodified output fails the same way (host supplies that symbol).
  Not part of this issue; don't read the exit code as (b) failing.
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

## 🔄 RE-OPENED 08-05 — assignee unavailable, scrub requested

**jkiviluoto-nv (MEMBER) cmt `5195816253`, 08-05T18:40Z:** *"Mukund (mkeshavaNV) won't
be returning to this work for a while. Please scrub this issue and assess whether it is
still relevant, needs reassignment, or should be closed."*

⛔**This VOIDS my stated reason for not dispatching a fixer** ("human assignee owns it").
A design gate still stands, but the gate now has **no gatekeeper** ⇒ the ask is a
*direction call from a maintainer who is actually present*, not from mkeshavaNV.

**Re-verified at LIVE master `b0e43d657d` (08-05T16:06Z), 10 commits ahead of my
`0864e60e6`:**
- **STILL RELEVANT.** `slang-emit-cuda.cpp` bypass (*"Skip the CPP impl"*) intact;
  prelude atomics at the **identical** lines `2719/2724/2732/2739`;
  `SLANG_PRELUDE_NAMESPACE` in the CUDA prelude still **0** occurrences.
- **None of the 300 changed files** in that range are ours (control: `.files|length`=300).
- **No competing work**: no PR touches either mechanism. #12242 (merged 07-31) is in the
  header-export area but ended up **docs-only** — its compiler changes were reverted per
  jkwak-work/csyonghe direction ⇒ no overlap. #12182 / #12080 are adjacent CUDA work.
- **OP has 2 issues ever** (#9736 + a 2024 one) ⇒ no ongoing engagement to reconfirm with;
  do NOT treat OP silence as "not relevant" — the defect is verified independent of them.

⚠️**FALSE ZERO I HIT AND CAUGHT**: a compound `q=…+A+OR+B+OR+C` REST search returned
`total_count: 0`; the same terms split into separate queries returned 5 / 112 / 2 / 23 / 5.
⇒ ⭐⭐**a multi-`OR` GitHub search query is a defective instrument — split it and control
each term.** Nearly published "no competing PR work" off that zero.

**Reassignment candidates (measured from REST commit history, since local clone is shallow):**
- `prelude/slang-cuda-prelude.h`: **szihs** (11), kaizhangNV (6)
- `source/slang/slang-emit-cuda.cpp`: **csyonghe** (6), kaizhangNV (4), szihs (4)
- ⇒ **szihs and kaizhangNV overlap both files**; csyonghe is the emit-side authority.
- No CODEOWNERS entry covers cuda/prelude/emit paths (checked; file has no such rule).

✅**POSTED 08-04 — cmt `5176126183`** by triager (`nv-slang-bot[bot]`, 4947 chars,
`comments=1` not stacked); `reproduced` label applied; Type already `Bug`.
Recommended **(b) first** (lowest risk, root-caused at the bypass, reference impl
already exists at `slang-emit-cpp.cpp:993`); **(a)** is the design-gated half.

**RESUME** = mkeshavaNV (or another maintainer) picks (a) namespace/guard the prelude
atomic overloads / (b) internal linkage for non-exported generated `__device__` funcs /
(c) both, scoped to `-target cuh`. ⚠️A **maintainer** direction call is the trigger — a
non-bot comment on the issue. No fixer (design gate + human assignee, #8306 precedent).

Related: [[feedback_control_the_instrument_not_the_reasoning]] (controls used
throughout), [[project_8306_embed_core_glsl_module_slang_dll]] (assignee-is-human
⇒ no fixer precedent).
