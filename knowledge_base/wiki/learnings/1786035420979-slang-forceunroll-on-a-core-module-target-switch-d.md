---
title: "Slang: [ForceUnroll] on a core-module __target_switch default arm — measure the arm set per overload, the FP and integer twins differ"
type: learning
topic: slang-compiler
source: learnings/1786035420979-slang-forceunroll-on-a-core-module-target-switch-d.md
---

# Slang: [ForceUnroll] on a core-module __target_switch default arm — measure the arm set per overload, the FP and integer twins differ

Triaging shader-slang/slang#12396 (CUDA emits a `for(;;)` + `_slang_vector_get_element` loop for `dot(float2,float2)` instead of `x.x*y.x + x.y*y.y`). Verified at master `d7d59f374`.

## The transferable trap: two overloads of the same builtin have DIFFERENT target arms

`hlsl.meta.slang` has two structurally identical `dot` fallbacks:

- **FP** `:10105-10131` — arms: `glsl`, `hlsl`, `metal`, `spirv`, `wgsl`, `default:`
- **integer** `:10158-10202` — arms: `hlsl`, `wgsl`, `spirv`, `default:` — **no `glsl`, no `metal`**

Both `default:` arms are byte-identical (`T result = T(0); for(int i=0;i<N;++i) result += x[i]*y[i];`) and neither
carries `[ForceUnroll]`. Consequence, MEASURED by emitting the same shader per target:

| target | FP `dot` | integer `dot` |
|---|---|---|
| hlsl / wgsl | native `dot()` | native `dot()` |
| spirv | `OpDot` | `OpDot` |
| glsl / metal | native `dot()` | **falls through to the loop** |
| cuda / cpp / torch | **loop** | **loop** |

⭐ **So `[ForceUnroll]` on the FP fallback is CUDA/C++/host-only, but on the integer fallback it also changes GLSL
and Metal output.** I measured the matrix on a *float* shader, concluded "C-like targets only", and recommended
patching both — a codex critique caught it and measurement confirmed: after patching both and doing a full
core-module rebuild, `cmp` says FP leaves hlsl/glsl/spirv/metal/wgsl **byte-identical** while the integer change
takes glsl and metal from 2 loops to 0. **A blast-radius measurement is per-overload, not per-function-name.**

## `[ForceUnroll]` failure mode is a HARD ERROR, and how to bound it

`unrollLoopsInModule` → `_unrollLoop`; on failure to prove termination it emits `Diagnostics::CannotUnrollLoop` =
**`error 40020`** (`slang-ir-loop-unroll.cpp:547-562`, `slang-diagnostics.lua:4887-4892`). Verified: a
`[ForceUnroll]` loop with a runtime trip count ⇒ exit 255 / 40020. So adding `[ForceUnroll]` to shared generic code
is not risk-free in general — but for `vector<T,N>` it is bounded, and the bound is a language rule, not a
convention: `N==1` early-returns before the switch, `N==0` folds to `return 0.0f` with no loop, and **`N>=5` is
rejected by `error E38206` "valid values are between 1 and 4 inclusive"**. Max trip count 4 ⇒ the unroller's 4096
attempt cap and any code-size concern are structurally unreachable. `BFloat16` uses a separate overload and
`CoopVec` is a distinct intrinsic type (not `vector<T,N>`), so neither widens the domain.
Unrolling runs *inside* the specialization fixpoint (`slang-ir-specialize.cpp:1720-1734`), after SCCP, so `N` is
already a literal by then — and there is no target gating on the pass.

## Unrolling an accumulator loop DROPS the `T(0) +` — a real signed-zero change

The loop form emits `float result = 0.0f; ... result + a*b`; the unrolled form emits `return x.x*y.x + x.y*y.y;`.
That is not cosmetic: IEEE-754 has `0.0 + (-0.0) == +0.0`, so seeding with `+0.0` *sanitizes* an all-negative-zero
sum. `dot(float2(-0.0,-0.0), float2(1,1))` ⇒ `+0.0` via the loop, `-0.0` unrolled.
Confirmed three independent ways: `slangi` (reciprocal `+inf` vs `-inf`), plain `cc -O0` C (so it's IEEE, not a
Slang quirk), and a **real CUDA device via `nvcc 12.6 -arch=sm_70`** (survives nvcc's default optimization).
Accumulation *order* is otherwise preserved — the unrolled form is the same left-associated chain `((a+b)+c)+d`.
⇒ When proposing "just unroll it", check whether the loop has an identity-element seed whose absorption is
observable. And scope the claim: emitted `OpDot`/native `dot()` on other targets tells you nothing about what
*their* runtime returns for that input — that is the backend's implementation, unmeasured unless you run it.

## Method notes that cost me probes

- **A freshness probe needs a subject that is actually recent in the file you care about.** My first two attempts
  were void: one failed with `E00070` (no `-entry`, so both cells errored for a harness reason) and the next with
  `E30015` (`IError` undefined). What worked: compile a shader that trips a diagnostic added to `hlsl.meta.slang`
  in a known recent commit (#12303's half-texture `static_assert`) with a float-texture control that compiles
  clean — that proves the *embedded core module* in the binary is fresh, which mtime alone does not.
- `grep -c` **exits 1 on zero matches**, so `x=$(grep -c ...); x=${x:-0}` is fine but `$(grep -c ... || echo 0)`
  emits *two* lines and corrupts a table. Cost me one garbled matrix.
- DeepWiki had no documented rationale for the asymmetry and *speculated* "possibly large N / code size" — which
  the N∈{2,3,4} measurement refutes. Don't republish a plausible-sounding guess from a doc tool as a finding.

## Provenance answer to "was this deliberate?" — the honest form

The maintainer asked whether the primal path was *deliberately* left un-unrolled while the autodiff path was not.
Git settles the strong version and not the weak one: the loop's lineage starts `18be2d81f` (2020-03-06) and
`[ForceUnroll]` did not exist until `4dbc74a95` (2023-02-13, #2644) ⇒ the original author *could not* have used it.
The `diff.meta.slang` precedent (`8b05df418`, #2659, 2023-02-20) was **autodiff-scoped** — all its tests are
`tests/autodiff/*` — so it reads as "reverse-mode needs statically-known trip counts", not a stdlib-wide policy.
But against pure oversight: `b4023f715` (2025-10-10, #8599) edited **both** fallbacks to add the `N==1` early
return and added no `[ForceUnroll]`. ⇒ Publishable form: **"consistent with historical omission; no evidence of an
intentional floating-point rationale"** — not "it was an accident". `git log -L <range>:<file>` over the function's
line range is the instrument that surfaced the later revisits; a bare `-S` on the attribute name would not have.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786035420979-slang-forceunroll-on-a-core-module-target-switch-d.md`_
