---
name: project_12403_integer_dot_fallback_glsl_metal
description: "shader-slang/slang#12403 — integer vector dot fallback loops on GLSL+Metal as well as CUDA/C++ (twin of #12396, FP). RESUME when triager posts its verdict or the #12396 PR lands. Design fork turns on whether a native glsl arm via dotEXT is viable."
metadata: 
  node_type: memory
  type: project
  originSessionId: d67fce4e-3bdb-4346-9e59-cfcfa799845c
---

# #12403 — integer `dot` fallback: dynamic-index loop on GLSL + Metal + CUDA/C++

Opened 2026-08-06 16:59Z by `nv-slang-bot[bot]`, split out of **#12396** (the floating-point twin,
opened by `tdavidovicNV`, a maintainer, with an explicit request for a small non-breaking PR).
Label `cuda` — likely wrong/incomplete given the GLSL+Metal exposure.

## Verified in-tree at master `d7d59f374` (Main, independently)

| | line range | `__target_switch` arms |
|---|---|---|
| FP `dot` | `source/slang/hlsl.meta.slang:10105-10131` | `glsl` `hlsl` `metal` `spirv` `wgsl` `default:` |
| integer `dot` | `:10158-10202` | `hlsl` `wgsl` `spirv` `default:` — **no `glsl`, no `metal`** |
| `BFloat16 dot` | `:10133-10156` | `spirv` `cuda` only — separate overload, widens neither domain |

Both `default:` arms are byte-identical and neither carries `[ForceUnroll]`:
`T result = T(0); for(int i = 0; i < N; ++i) result += x[i] * y[i]; return result;`

So the issue body's structural claim is correct: the integer overload's missing `glsl`/`metal` arms
are what put those two targets on the loop path.

## The design fork, and where it stands

The body offers two remedies: `[ForceUnroll]` on the shared fallback, or add native `glsl`/`metal`
arms for integer `dot`.

⛔ **I challenged option 2 as infeasible and was half wrong.** GLSL's plain `dot` really is
FP-only (spec §8.5; confirmed by live glslang rejection) — but integer dot exists as **`dotEXT`**
under `GL_EXT_integer_dot_product`. Full derivation of how three converging probes all missed it:
[[feedback_a_name_scoped_capability_negative_survives_every_widening]].

- **Metal has no analogue** — MSL §6.9 verbatim: *"T is a vector floating-point type (floatn or
  halfn)."* So even if the GLSL arm is built, Metal stays on the fallback, and `[ForceUnroll]` is
  still required for it. **Option 2 cannot replace option 1; at most it narrows it.**
- **`dotEXT` gate in bundled glslang** (`Initialize.cpp:2300`): `(ES && version >= 300) ||
  (non-ES && version >= 450)`, one `commonBuiltins.append` block covering all widths. Slang's GLSL
  emitter floors at `#version 450` (`slang-emit-glsl.cpp:3380`, `requireVersion(GLSL_450)`), so the
  version gate is satisfied by construction on the desktop path.

## What Slang would need for a native `glsl` arm — machinery status

✅ **The declarative machinery exists.** `__glsl_extension(<NAME>)` is a real attribute
(parsed at `slang-parser.cpp:10839`, `_makeParseModifier("__glsl_extension", …)`) with **300 uses**
in `hlsl.meta.slang` across ~30 distinct extensions, and it flows to
`GLSLSourceEmitter::_requireGLSLExtension` → `m_glslExtensionTracker->requireExtension`
(`slang-emit-glsl.cpp:163-165`). So "Slang has zero extension machinery" is too strong — what is
missing is this *one* extension's wiring, not the mechanism.

❌ **No capability atom exists**: `grep -c GL_EXT_integer_dot_product slang-capabilities.capdef` → **0**.
The established two-line pattern would have to be added (cf. `GL_EXT_texture_shadow_lod`):
`def _GL_EXT_integer_dot_product : _GLSL_450;` at `capdef:~1020`, then
`alias GL_EXT_integer_dot_product = _GL_EXT_integer_dot_product | SPV_KHR_integer_dot_product;`
at `~1180`. Note the alias would tie the GLSL atom to the SPIR-V extension Slang **already** names
at `hlsl.meta.slang:10179`.

## ⚠️ Type-domain mismatch — unresolved, and it may sink option 2 on its own

The Slang generic is `__generic<T : __BuiltinIntegerType, let N : int>`. Per
`core.meta.slang:1155-1170`, `__BuiltinIntegerType` covers **Int8/16/32/64 + IntPtr and
UInt8/16/32/64 + UIntPtr**. `dotEXT` covers 8/16/32/64-bit vec2/3/4 — **no pointer-width form**.
Two consequences a native arm must answer:

1. **Return width diverges for sub-32-bit `T`.** glslang declares `int dotEXT(i8vec3, i8vec3)` and
   `uint dotEXT(u16vec2, u16vec2)` — 8- and 16-bit operands return **32-bit**. Slang's generic
   returns `T`. Since `__intrinsic_asm` inserts no result cast (triager confirmed at source, after
   retracting a different float32-corruption mechanism), `dot(int8_t3, …)` would emit a 32-bit
   value into an 8-bit context. **I have not verified whether that is a glslang error or a silent
   widening — that is a measurement, not a claim.**
2. **`IntPtr`/`UIntPtr` have no `dotEXT` form at all**, and 8/16-bit operand *types* need
   `GL_EXT_shader_explicit_arithmetic_types_int8`/`int16` to be nameable in GLSL independently of
   the dot extension. So a correct `glsl` arm is conditional on `T`, not a flat `__intrinsic_asm`.

⇒ Realistic shape: `[ForceUnroll]` on the shared fallback is the change that actually covers Metal,
CUDA/C++ **and** the integer widths GLSL cannot express. A `dotEXT` arm is a separate, narrower,
optional improvement — not a substitute.

## Semantics — this twin is the safer one

The signed-zero behaviour change that constrains #12396 (unrolling drops the initial `T(0) +`, so an
all-`-0.0` dot flips sign; triager measured it on real `nvcc 12.6 -arch=sm_70`, reciprocal
`+inf` vs `-inf`) **cannot arise for integers**. Only the target surface is wider.

Unroll domain is bounded, so no `error 40020` risk: `N == 1` early-returns before the switch,
`N == 0` folds, `N >= 5` is rejected by `E38206`. Max trip count 4.

## Chain state

✅ **TRIAGED 2026-08-06 18:37:59Z — verdict cmt `5208262380`** (`nv-slang-bot[bot]`, 12,086 chars,
fresh: comments=1). Labels corrected `cuda` → **`cuda`+`GLSL`+`Metal`** (repo uses capitalized
`GLSL`/`Metal`; 3 existing issues carry both ⇒ co-labelling has precedent). Verdict = **Approach A
only**: `[ForceUnroll]` at pristine `hlsl.meta.slang:10199`. `dotEXT` surfaced as the acknowledged
narrower alternative, not silently omitted. No fixer dispatched from that chain — #12396's fixer
already holds an inlined patch. Memo `triage-12403.md`, 285 lines.

**Width question settled (was mine, flagged unmeasured, measured by the triager through real glslang):
it errors, it does not silently widen.** `int8_t`/i8vec3 and `int16_t`/i16vec3 **REJECTED**
(`'=' : cannot convert from ' global int' to ' temp int8_t'`); `int`/`uint`/`int64_t` compile
(708/740/800 B). CONTROL: the same `i8vec3` call assigned to a 32-bit `int` compiles (848 B) ⇒ the
rejection is the **width**, not the call. ⇒ a flat `case glsl: __intrinsic_asm "dotEXT";` is illegal
for 8/16-bit `T`; option B must be conditional on `T`. Combined with Metal having no analogue,
**option B cannot replace A — at most it narrows it.**

⛔ **The end-to-end guilty control was ABANDONED and the verdict says so.** The triager patched a
native `glsl` arm on and rebuilt; the build failed on
`undefined reference to Slang::Diagnostics::EntryPointCannotThrow::getInfo()` — a symbol generated
from `slang-diagnostics.lua`, which its patch never touched. A **sibling session mid-flight on #12330**
was editing the same clone. It diagnosed before believing, preserved the sibling's work, reverted only
`hlsl.meta.slang`, and softened the verdict to state the end-to-end step as *inferred* from the two
measured facts (glslang rejecting the call; `slang-emit-c-like.cpp:2147` inserting no result cast)
rather than observed. Right call — cf. the two claims it had already retracted the same hour.

⛔ **My own correction to its handoff warning: the tree hazard was mis-scoped across containers.**
It warned "that clone is being written by more than one session" *for the #12396 fixer* — but
`slang-fixer/slang` is a **different clone**: same device `/dev/vdb`, different inode
(triager `ino=41715721`, fixer `ino=44840020`). The #12330 sibling is in the triager's tree and
cannot touch the fixer's. Fourth instance of the cross-container path-scoping family — see
[[feedback_name_the_agent_as_well_as_the_path]] and the `prunable` trap in
[[project_triager_clone_nine_concurrent_writers]]. **The hazard is nonetheless real for the fixer from
its own siblings: 15 concurrently-running sessions on its one clone (triager has 49).**

⭐ **Triager's refinement, adopted: key the rule on the observable, not the population.** Session
count is a *rate* claim and is unmeasurable from inside a container; "is my tree being written right
now" is a *state* claim and is checkable. ⇒ **before and after any build in a clone you don't
exclusively own, diff `git status --porcelain | grep -v '^??'`** — foreign mods are indistinguishable
from your own breakage once the compiler complains, and a *disappearing* mod is your own patch being
erased. ⚠️ But see the completion below: a clean status diff is **not** sufficient on its own.

- Issue had **0 comments** at 17:05Z — no public footprint. Triager owns posting the verdict.
- No PR or branch for either twin: `fix/issue-12396` and `fix/issue-12403` both absent upstream at 17:05Z.
- **#12396 dispatched to `slang-fixer`** ~17:03Z by the triager, with an inlined single-hunk patch at
  `hlsl.meta.slang:10124`, FP-only scope. This issue's patch lands at `:10197` — same file, no
  textual conflict, but the second to land must rebase and re-run
  `cmake -E touch` + `generate_core_module_headers`.
- Triager repaired the issue body in place (the false "both languages do have an integer `dot`"
  parenthetical was its own, PATCHed while comments were still 0).
- ⚠️ Build hazard the triager hit and flagged: **the generated core-module header is shared across
  configs, not per-config** — a concurrent Debug build poisons a Release restore. Related:
  [[feedback_group_clone_is_shared_by_all_sessions_of_one_coworker]].
- No emitted-shape test exists today: 0 files under `tests/` reference `_slang_vector_get_element`
  or a `dot_N` helper (49 mention `dot(`), so the regression test would be the first.

## RESUME when

- The triager posts its verdict on #12403 (watch for the ordering decision: sequence behind #12396
  vs fold), **or**
- the #12396 PR opens/lands (then #12403's rebase obligation activates), **or**
- any fresh substantive human comment on either issue — catch-all, outranks the above
  (cf. [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind]]).
