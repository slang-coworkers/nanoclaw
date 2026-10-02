---
name: project_12403_integer_dot_fallback_glsl_metal
description: "shader-slang/slang#12403 — integer vector dot fallback looped on GLSL+Metal+CUDA/C++ (twin of FP #12396). TERMINAL 2026-08-25: closed as fixed by #12417 (which unrolled BOTH dot arms despite its FP-only title); test-only companion PR #12548 merged. Kept: dotEXT/Metal design facts, the map-then-lower long-term direction, and chain lessons."
metadata: 
  node_type: memory
  type: project
  originSessionId: d67fce4e-3bdb-4346-9e59-cfcfa799845c
---

# #12403 — integer `dot` fallback: dynamic-index loop on GLSL + Metal + CUDA/C++

✅ **TERMINAL 2026-08-25. Nothing owed.** #12403 CLOSED by `jvepsalainen-nv` (cmt `5391239984`) as
fixed by **#12417** (merged 2026-08-22 01:15Z, `70228af62f…`). #12417 is titled *"Unroll the generic
floating-point `dot` fallback"*, but its diff adds `[ForceUnroll]` to **both** arms (hunks `@@ -10124`
FP and `@@ -10196` integer) — the title mismatch is why nothing auto-closed #12403. Its tests are
CUDA/CPP only (`tests/cuda/vector-dot-unroll.slang`, `tests/cuda/vector-dot-signed-zero.slang`).
Companion **PR #12548** was reduced to test-only on the maintainer's directive and **merged
2026-08-25 14:08:50Z** by `jvepsalainen-nv` (merge `5faf399a7d…`, head `715dec4e0a`, Main-verified):
`tests/hlsl-intrinsic/vector-dot-int-unroll.slang` checks that widths 2/3/4 emit 0 `for` tokens on
glsl/metal/cuda — the targets #12417 didn't test. Worktree `wt-slang-12403` cleaned up.

## Root cause (verified at master `d7d59f374`)
| | range in `hlsl.meta.slang` | `__target_switch` arms |
|---|---|---|
| FP `dot` | `:10105-10131` | glsl hlsl metal spirv wgsl default |
| integer `dot` | `:10158-10202` | hlsl wgsl spirv default — **no glsl, no metal** |
| `BFloat16 dot` | `:10133-10156` | spirv cuda only |

Both `default:` arms were the same un-unrolled `for (int i = 0; i < N; ++i) result += x[i]*y[i];`
loop, so the missing arms put GLSL and Metal on the loop path. Unroll is safe: `N==1` returns early,
`N==0` folds, `N>=5` is rejected by `E38206` (max trip count 4, no `error 40020` risk). Unlike #12396,
the signed-zero change from dropping `T(0) +` can't arise for integers.

## Why a native-arm fix couldn't replace `[ForceUnroll]` (design facts worth keeping)
- **GLSL:** plain `dot` is FP-only (spec §8.5), but integer dot exists as **`dotEXT`**
  (`GL_EXT_integer_dot_product`; bundled glslang gate `Initialize.cpp:2300`, satisfied by Slang's
  `#version 450` floor at `slang-emit-glsl.cpp:3380`). How three probes missed it:
  [[feedback_a_name_scoped_capability_negative_survives_every_widening]].
- `dotEXT` returns 32-bit for 8/16-bit operands; measured via glslang, `int8_t`/`int16_t` results are
  **rejected** (`cannot convert from ' global int' to ' temp int8_t'`), int/uint/int64 compile, and an
  i8vec3 call assigned to a 32-bit `int` compiles (control). `__intrinsic_asm` inserts no result cast
  (`slang-emit-c-like.cpp:2147`), and `IntPtr`/`UIntPtr` have no `dotEXT` form ⇒ a glsl arm would
  have to be conditional on `T`.
- Machinery: `__glsl_extension(...)` exists (`slang-parser.cpp:10839`, ~300 uses) → 
  `_requireGLSLExtension` (`slang-emit-glsl.cpp:163-165`); **no capability atom** for
  `GL_EXT_integer_dot_product` in `slang-capabilities.capdef` (pattern: `def _GL_EXT_… : _GLSL_450;`
  + alias with `SPV_KHR_integer_dot_product`).
- **Metal has no analogue** (MSL §6.9: `dot` is floating-point only) ⇒ the fallback must unroll
  regardless. `dotEXT` would only narrow `[ForceUnroll]`, never replace it.
- **Long-term direction (deferred by maintainers):** `jhelferty-nv` (cmt `5271029475`, 08-12) relayed
  Tess's preference to generate `dot` as a map/reduction that only lowers to a loop when the trip
  count is unknown (*"we might have done something similar for coopvector?"* — unverified lead), and
  chose the incremental fix for now.

## Chain lessons
- **Titles and prose lie; diffs don't.** #12417's diff, not its title, proved it covered the integer
  arm; #12548's diff proved it was source-redundant but test-additive.
- **A memo written across an inactive gap is a conclusion about a period I didn't observe.** On 08-21
  I wrote "HOLD, no dispatch, no `fix/issue-12403` branch" after being idle since 08-12; the triager
  had dispatched the fixer and PR #12548 had been open since 08-14. Check
  `gh pr list --head fix/issue-<n>` before writing HOLD
  ([[feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer]]).
- **Concurrent writers in a shared clone.** The triager's guilty-control build failed on an
  undefined `EntryPointCannotThrow::getInfo()` symbol from a sibling session's
  `slang-diagnostics.lua` edit; it preserved the sibling's work, reverted only its own file, and
  restated the end-to-end step as *inferred*. Before and after a build in a clone you don't
  exclusively own, diff `git status --porcelain | grep -v '^??'` (a necessary check, not a
  sufficient one). The generated core-module header is shared across configs, so a concurrent Debug
  build poisons a Release restore ([[feedback_group_clone_is_shared_by_all_sibling_sessions]]).
  Hazard scope is per clone: the triager's and fixer's clones are different inodes on the same
  device ([[feedback_name_the_agent_as_well_as_the_path]],
  [[project_triager_clone_nine_concurrent_writers]]).
- **A dark turn (empty model return) is worth one re-send** regardless of cause — the 08-12 triager
  handoff produced nothing (host zero-content fallback, seq 29), and the 08-21 re-send worked.
