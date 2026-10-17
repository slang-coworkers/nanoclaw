---
type: project
name: project_12420_unroll_before_vector_width_validation
description: "#12420: an over-wide vector reached through [ForceUnroll] (fwd_diff dot) reports E40020 unroll-failed instead of E38206 invalid-width, and at N=4095 takes ~16 min to give the right error. Own-bot filing, so zero dispatch; 5 additive findings posted (cmt 5211967028): the naive reorder cannot work (validator walks global insts only) and PR #12417's diagnostics test is inert. Since 08-12 maintainers own it (jkwak-work + zangold-nv); HELD, no bot action."
metadata:
  node_type: memory
  type: project
  originSessionId: ecbf7542-514e-4f4b-a534-dafcc5d8a208
---

# #12420: the unroller runs before vector-width validation (E40020 instead of E38206)

Filed 2026-08-07 02:56Z by `nv-slang-bot[bot]` while triaging #12396 and reviewing PR #12417. Thread
`gh-issue-shader-slang/slang-12420`.

## Routing

Our own filing echoing back, so no triager or fixer was dispatched (same class as
[[project_12402_slang_attr_namespace_unowned]] and [[project_12320_coverage_macos_segfault_base_rate]]). The
commissioned-filing exception ([[project_12333_dev_null_output_path_tests]]) did not apply: the only comment on #12417
was a board-bot shepherd assignment. Echo is a reason not to redo work, never a reason to withhold new verified content
([[project_bot_comment_webhook_echo]]), so I posted additive findings only.

## Reproduction (master `88fa1206d`, `-target cuda`)

| cell | shape | result |
|---|---|---|
| a | `vector<float,5000>` through `fwd_diff` | exit 255, E40020, no E38206 |
| b | same width, no autodiff | exit 255, E38206, no E40020 |
| c | `vector<float,4>` through `fwd_diff` | exit 0 |

Citations: `diff.meta.slang:1597` `[ForceUnroll]` on `__d_dot`; `slang-ir-loop-unroll.cpp:55`
`kMaxIterationsToAttempt = 4096`; `slang-emit.cpp:1421` `specializeModule`, `:2393` `validateVectorsAndMatrices`;
`slang-ir-validate.cpp:629` `maxCount = 4`. The binary was current for this path (checked per file).

## The five findings (comment [5211967028](https://github.com/shader-slang/slang/issues/12420#issuecomment-5211967028))

1. **The fix adds a pass; it cannot just swap two.** `unrollLoopsInModule` runs inside the specialization fixpoint
   (`slang-ir-specialize.cpp:1734`), and the comment at `:1720-1728` calls it the only call site and
   "semantics-bearing, not an optimization."
2. **The suggested reorder does not work as framed.** `validateVectorsAndMatrices` walks `module->getGlobalInsts()`
   only (`slang-ir-validate.cpp:645`), and before `specializeModule` there are 0 global `Vec(...)` insts for both the
   repro and a generic `vector<float,M>` variant. Running the same validator earlier reports nothing. That changes the
   cost of the remedy, not the diagnosis.
3. **Running it earlier would expose an unguarded cast.** `slang-ir-validate.cpp:623` derefs
   `as<IRIntLit>(vectorType->getElementCount())` without a null check, and symbolic counts exist before specialization.
   Repo-wide, 5 of 58 such sites are unguarded; bind-and-test is house style.
4. **`maxCount = 4` is not duplicated today.** The other literal `4`s (`slang-emit-hlsl.cpp:1627`,
   `slang-check-expr.cpp:8103`, `slang-intrinsic-expand.cpp:673/843`) are swizzle bounds that happen to share the
   value. Exporting the constant prevents a future copy; re-pointing those sites at it would be wrong.
5. **The cost is worse than the wrong message, and it sits just below the boundary.** Via `[ForceUnroll]`: N=1000 →
   34 s, N=2048 → 166 s, **N=4095 → 970 s**, each ending in the correct E38206; N≥4096 → ~1 s with E40020. The same
   width without the unroll path gives E38206 in ~1 s.

Also on the issue: **PR #12417's new `tests/diagnostics/vector-dot-oversized-width.slang` passes on unpatched master.**
The primal `dot` arm (`hlsl.meta.slang:10105-10131`) has no `[ForceUnroll]`; only the derivative does, so a plain `dot`
call never reaches the unroller. The fixer had armed the assertion but never revert-drilled the scenario
([[feedback_optimized_lane_can_be_inert_for_the_fix]]). `tests/cuda/vector-dot-unroll.slang` was not evaluated.
In-tree, the 3 tests asserting `40020` all use a `[ForceUnroll(10)]` while loop, so no test pins the wrong output for
an over-wide vector.

## State

- **08-07:** #12420 open with my comment only. PR #12417 (`fix/issue-12396`) a draft guarding the primal arm with
  `if (N <= 4)`. #12396 open (tdavidovicNV, `cuda`).
- **08-12 18:30Z:** jhelferty-nv (5271073626): *"It sounds like this is a 'generate a better diagnostic' issue? Zach,
  mind triaging?"* Assignees are now jkwak-work and zangold-nv. **HELD, no bot action:** it is maintainer-to-maintainer,
  has no `@nv-slang-bot` mention (so posting is not authorized), and findings 2 and 5 already answer the scope question.

**Resume** only if a maintainer asks the bot something (a mention, or a request for data not already on the issue), or
wants help with the ordering fix or the exported constant. A fresh substantive human comment triggers re-evaluation,
which can correctly end in HOLD ([[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind]]). If
#12417 moves toward ready, the inert-test finding becomes a live hazard on that PR's chain
([[project_12417_vector_dot_unroll_bound_review]]).

## Instrument errors caught during this chain

- `slangc … | head -6; echo "EXIT=$?"` printed `EXIT=0` for all three cells, because `$?` was `head`'s
  ([[feedback_never_read_an_exit_status_through_a_pipe]]).
- A timed-out sweep left inputs unwritten, and E00001 shared exit 255 with the real error
  ([[feedback_grep_the_error_code_when_the_exit_status_is_shared]]).
- "5 unguarded against 58 guarded" was wrong: 58 was the total. A grep total is not the complement of its subset.

Related: [[project_12403_integer_dot_fallback_glsl_metal]] (the #12396 twin in the same `dot` fallback family).
