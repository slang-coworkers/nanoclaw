---
name: project_12420_unroll_before_vector_width_validation
description: "#12420 over-wide vector reports E40020 unroll-failed instead of E38206 invalid-width when a [ForceUnroll] path is present. Own-bot echo ⇒ ZERO dispatch; I posted 5 additive findings (cmt 5211967028). ⭐The suggested reorder does NOT work as framed — the validator walks GLOBAL insts only and there are 0 global Vec insts pre-specialize. ⛔PR #12417's diagnostics test PASSES on unpatched master ⇒ inert."
metadata:
  node_type: memory
  type: project
  originSessionId: ecbf7542-514e-4f4b-a534-dafcc5d8a208
---

# #12420 — unroller runs before vector-width validation, substituting E40020 for E38206

Filed **2026-08-07T02:56:57Z by `nv-slang-bot[bot]`**, no labels, no assignee, 0 comments at arrival.
Canonical thread `gh-issue-shader-slang/slang-12420`. Surfaced while triaging #12396 / reviewing
PR #12417.

## Routing: own-bot echo ⇒ ZERO dispatch (no triager, no fixer)

Same class as [[project_12402_slang_attr_namespace_unowned]] /
[[project_12320_coverage_macos_segfault_base_rate]]. Provenance is our own #12396 chain. Checked the
[[project_12333_dev_null_output_path_tests]] commissioned-filing escape hatch and it does **NOT**
apply: the only comment on PR #12417 is `jhelferty-nv`'s automated *"PR board sync: auto-assigned
@jkwak-work as shepherd for this Bot PR"* (73 chars, id 5211460190) — a board bot, not a maintainer
asking for a filing. The only comment on #12396 is our own bot's. Zero reviews on #12417. ⇒ echo rule
holds; the body already IS the triage writeup.

Per [[project_bot_comment_webhook_echo]]: echo is a reason not to RE-DO the work, never a reason to
withhold NEW verified content ⇒ I posted additive findings only.

## Verified at master `88fa1206d` — the body is accurate

Binary currency checked the per-file way (the [[project_12402_slang_attr_namespace_unowned]] method):
`build/Release/bin/slangc` mtime **08-04 07:50**, and the last commit touching *any* file on this path
(`slang-emit.cpp` aside) is **`0864e60e6` 08-04 04:18** ⇒ binary is current **for this path**.
⚠️`slang-emit.cpp` itself was touched by HEAD `88fa1206d`, but the diff is a single hunk at
`@@ -3416` (`createArtifactFromIR`) — nowhere near the two pass positions at `:1421`/`:2393`.

All three cells reproduce exactly as filed, `-target cuda`:

| cell | shape | result |
|---|---|---|
| a | `vector<float,5000>` through `fwd_diff` | exit 255, **E40020 present / E38206 absent** |
| b | same width, no autodiff | exit 255, **E38206 present / E40020 absent** |
| c | `vector<float,4>` through `fwd_diff` | exit 0, no errors |

Every citation holds: `diff.meta.slang:1597` = `[ForceUnroll]` on `__d_dot` · `slang-ir-loop-unroll.cpp:55`
= `kMaxIterationsToAttempt = 4096` (bound consumed at `:320`, the `attempedIterations < maxIterations`
loop) · `slang-emit.cpp:1421` `specializeModule` · `:2393` `validateVectorsAndMatrices` ·
`slang-ir-validate.cpp:629` `maxCount = 4`.

## ⛔ MY INSTRUMENT ERROR — `EXIT=$?` after a pipe reads the LAST stage

First run of all three cells printed `EXIT=0` for every cell, which would have refuted the whole
filing. Cause: `slangc ... 2>&1 | head -6; echo "EXIT=$?"` — `$?` is **`head`'s** status, not
`slangc`'s. Re-run redirecting to a file first ⇒ 255/255/0, matching the body.
⭐⭐**A pipe silently relocates the exit code, and `head` essentially always succeeds ⇒ the defect fails
toward `EXIT=0`, i.e. toward "no bug here."** Never read `$?` through a pipe; redirect, then test.

## ⛔ SECOND INSTRUMENT ERROR — a timed-out `sed` produced a phantom `exit=255`

The first boundary sweep loop hit the 2-minute tool timeout mid-iteration, so `n4096.slang`/
`n4097.slang` were **never written**. The next run reported `N=4096 exit=255` — which looked like the
substitution firing — but the output was `error[E00001]: cannot open file`. ⭐⭐⭐**Two different
failures share exit 255 here: the real diagnostic and a missing input file.** Reading the exit code
alone would have banked a correct-looking boundary from a file that did not exist. **Grep the actual
error code, never the exit status, when the exit status is shared by the failure mode you fear.**
(Same family as the E00001-vs-real-error confusion; cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].)

## The 5 additive findings I posted — comment [5211967028](https://github.com/shader-slang/slang/issues/12420#issuecomment-5211967028)

**1. The unroller is not a transposable neighbour of the validator.** `slang-ir-specialize.cpp:1734`
calls `unrollLoopsInModule` **inside the specialization fixpoint's per-round cleanup group**, and the
comment at `:1720-1728` says verbatim this is *"its only call site in the pipeline"* and that it is
*"semantics-bearing, not an optimization."* ⇒ the fix is *adding a pass*, not swapping two
`SLANG_PASS` lines.

**2. ⭐⭐⭐ THE SUGGESTED DIRECTION DOES NOT WORK AS FRAMED — measured, not argued.**
`validateVectorsAndMatrices` iterates **`module->getGlobalInsts()` only** (`slang-ir-validate.cpp:645`).
Dumped `-dump-ir-before specializeModule` for both the reported repro and a generic
`g<let M:int>(vector<float,M>)` variant: **global-scope (column-0) `Vec(...)` inst count = 0** in
both. Every wide vector type lives nested in function bodies / `specialize(...)` operands at that
point. ⇒ "run the same pass earlier" reports **nothing** and the compile still aborts in the
unroller. The pass would have to walk function bodies. **This does not refute the issue's diagnosis —
only its remedy's cost estimate.**

**3. A reorder would newly expose an unguarded cast.** `slang-ir-validate.cpp:623` is
`as<IRIntLit>(vectorType->getElementCount())->getValue()` with **no null check**, while the matrix arm
30 lines below (`:653-654`) *does* bind-and-test. Safe today only because specialization has already
made every count a literal. Pre-specialize, symbolic `Vec(%T, %N)` insts exist ⇒ null deref.
Repo-wide: **58** `as<IRIntLit>(...getElementCount())` sites, **5** unguarded derefs, **53**
bind-and-test ⇒ guarded is house style.
⚠️I first wrote "5 unguarded against 58 guarded" — 58 is the **total**, which includes the 5. Caught
and corrected pre-post. ⭐*Same shape as the [[project_12333_dev_null_output_path_tests]] chain's
"matches→files" error: a grep total is not the complement of its subset.*

**4. Second finding confirmed, with a scope caveat that matters.** `maxCount = 4` is function-local
with no exported name — true. **But it is NOT currently duplicated as a width limit anywhere**: the
other literal `4`s (`slang-emit-hlsl.cpp:1627`, `slang-check-expr.cpp:8103`,
`slang-intrinsic-expand.cpp:673` and `:843`) are **swizzle-length / syntax-sugar** bounds that merely
share the value. ⇒ exporting the constant prevents a *future* copy and lets #12417's guard name it;
it de-duplicates nothing today, and mechanically re-pointing those four at it would be **wrong**.
⭐**"A repo-wide search finds no named constant" and "the value is duplicated" are different claims —
the body implies the second from the first.**

**5. ⭐⭐⭐ SEVERITY IS WORSE THAN A WRONG MESSAGE, AND THE COST IS *BELOW* THE BOUNDARY.** Measured,
cell-(a) shape, `-target cuda`:

| N | via `[ForceUnroll]` (cell a) | direct (cell b) |
|---|---|---|
| 1000 | 34 s → E38206 | — |
| 2048 | 166 s → E38206 | **1 s** → E38206 |
| **4095** | **970 s** → E38206 | — |
| 4096 | 1 s → **E40020** | — |
| 5000 | 2 s → **E40020** | 1 s → E38206 |

Boundary claim confirmed exactly (4095 unrolls and reports correctly; ≥4096 substitutes). ⭐**But the
expensive region is just under the boundary: at N=4095 a user waits ~16 minutes to be told the vector
is too wide, vs ~1 s for the identical width with the `[ForceUnroll]` path out of the way — a ~970×
penalty on a program invalid from the front end.** Above 4096 it fails fast with the wrong message;
below, it succeeds slowly with the right one. Both halves argue for the same remedy.

## ⛔⭐⭐⭐ PR #12417's NEW DIAGNOSTICS TEST IS INERT — passes on unpatched master

Ran the exact body of `tests/diagnostics/vector-dot-oversized-width.slang` (from the PR's diff)
against **unpatched** master: **`E38206`, exit 255, `//CHECK: invalid vector element count` PASSES
without the fix.** Cause: the **primal** `dot` default arm (`hlsl.meta.slang:10105-10131`) carries
**no** `[ForceUnroll]` (grep of that exact range = 0); the `[ForceUnroll]` is on the **derivative**
(`diff.meta.slang:1597`). A plain non-`[Differentiable]` `dot` call never reaches the unroller ⇒ the
test never exercised the reported failure. Reproducing it needs the `fwd_diff` shape.
⭐⭐⭐**This is the [[feedback_optimized_lane_can_be_inert_for_the_fix]] class again, and it survived
the very drill that file prescribes** — the fixer *did* arm its `CHECK-NOT`→exhaustive-mode fix on the
matcher, but the **repro shape** was never revert-drilled, so the test would stay green with the guard
backed out. **Arming the assertion is not the same as arming the SCENARIO.**
I flagged this on #12420 rather than on #12417, since it bears on whether this issue's repro is the
one being pinned. **Did NOT evaluate `tests/cuda/vector-dot-unroll.slang`** (the PR's other test) —
stated as unevaluated in the comment.

## Upstream state at close (2026-08-07 03:34Z)

- **#12420** OPEN, 1 comment (mine, `5211967028`), no labels, no assignee.
- **PR #12417** `fix/issue-12396`, **draft**, head `44cc96e4a00a`, 3 files **+77/−0**,
  `mergeable_state=behind`, 0 reviews, shepherd `jkwak-work` (board-bot assigned).
  Guards the **primal** arm with `if (N <= 4)` and a comment that explicitly names the
  `maxCount` coupling.
- **#12396** OPEN, author `tdavidovicNV` (maintainer), label `cuda`, 1 bot comment.
- Dedup check: `search/issues` for `loop unrolling failed` ⇒ 3 hits, only #12420 is this defect
  (#10491 is a const-static-buffer unroll bound; #9399 closed, ps_5_0).
- In-tree tests asserting `40020`: **3** (`tests/obfuscate/obfuscated-check-loc.slang` + its
  `.expected`, `tests/serialization/obfuscated-module-check-loc.slang`) — all use a
  `[ForceUnroll(10)]` `while` loop, **zero over-wide vectors** ⇒ **no in-tree test asserts the
  current wrong output for an over-wide vector**, answering the body's open "not verified here" note.
  Tests asserting `38206`: **1** (`tests/diagnostics/invalid-vector-element-count.slang`).

## 2026-08-12 18:30Z — MAINTAINERS TOOK OWNERSHIP; chain HELD, no bot action

`jhelferty-nv` (human) commented (id `5271073626`): *"It sounds like this is a 'generate a better
diagnostic' issue? Zach, mind triaging?"* Assignees now **`jkwak-work` + `zangold-nv`** (Zach), no
labels yet. This fired my catch-all RESUME clause (substantive human comment) — re-evaluated on
merits per the spine's "a substantive human comment re-opens a holding chain" rule.

**Disposition: HOLD, zero bot action. NOT a silent no-op — a deliberate close-again.** Three reasons,
each sufficient:
1. ⭐**It is maintainer-to-maintainer, not addressed to the bot.** `jhelferty` is asking Zach to
   triage; the bot is not the audience. Inserting a bot reply into a human triage handoff is the
   anti-pattern, not observability.
2. **No `@nv-slang-bot` mention ⇒ NOT `<github-post-authorized />`.** Posting would be unauthorized.
3. **The scope question is already answered by my comment `5211967028`, which is on the issue for
   Zach to read.** His framing ("just a better diagnostic?") is exactly what findings 2 (naive
   reorder doesn't work) + 5 (~970× compile-time cost, not just wrong text) speak to. Nothing new to
   add; re-posting would be an echo.

No coworker was ever dispatched (maintainer design call from the start) ⇒ nothing to re-dispatch.
The maintainers own it now.

## RESUME (updated)

Only on: a maintainer/human comment that **asks the bot** something (mentions `@nv-slang-bot`, or
requests a repro/fix/data the evidence on-issue doesn't already cover), OR a maintainer picking up the
ordering fix / exported-constant question and wanting help. A further *"Zach triaging"*-style
human-to-human exchange is **not** a bot cue — hold. **Catch-all
(per [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind]]): any fresh
substantive human comment fires re-evaluation, but re-evaluation can correctly conclude HOLD — the
trigger is to THINK, not necessarily to POST.** ⚠️If #12417 moves toward ready/merge, the inert-test
finding above becomes actionable on **that** PR's chain — a live hazard for whoever reviews it.

Related: [[project_12403_integer_dot_fallback_glsl_metal]] (the #12396 twin, same `dot` fallback
family) · [[project_bot_comment_webhook_echo]] (echo rule) ·
[[project_12402_slang_attr_namespace_unowned]] (echo + additive-finding precedent, and the per-file
binary-currency method) · [[project_12333_dev_null_output_path_tests]] (commissioned-filing
exception, checked and absent) · [[feedback_optimized_lane_can_be_inert_for_the_fix]] (the inert-test
class, extended here to inert *scenario*).
