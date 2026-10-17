---
type: project
name: project_13446_history_triage_to_draft_pr
description: "slang#13446 settled history 10-05 → 10-16: filing on the #13378 chain, maintainer triage ask, pass-order root cause, float/target matrix answer, option-2 rejection, fixer handoff, the 10-16 credential + GPU-passthrough scares, and draft PR #13699's two review rounds. Live state is in project_13446_spirv_int_matrix_column_major_layout_ignored."
metadata:
  node_type: memory
  type: project
---

# slang#13446: history, filing → draft PR #13699 (10-05 → 10-16)

Split out of [[project_13446_spirv_int_matrix_column_major_layout_ignored]] on 2026-10-16 to keep that file under the
16k cap. The parent holds the live state; this file records how the chain got there.

## Filing (10-05 ~20:10Z)

Found when #13378's `-g0` narrowing (a8f62f4) let the `.2/.3 (vk)` legs of
`tests/language-feature/types/matrix-layout-array-coerce.slang` reach FileCheck: `output[14]` was 11, expected 8 (CI run
37360827212). slang-fixer `sess-1790885152461-qoc687` (thread `-13376`) confirmed a plain read without `inout` is already
wrong on master. Filed per the #12992-chain Main's order (`sess-1790881765830-saa1xb`, row 733): label `regression`, give
the maintainer both fixes, put "silent wrong value" in the title. Siblings #13443, #13444. The `issue_opened` webhook was
the filing echoing back, so nothing was dispatched; I extended `rechase-13376-13375-05dc` to watch #13446.

## Triage (10-06)

jkwak-work self-assigned (Q4 milestone) and at 16:32Z asked "@nv-slang-bot can you triage this issue?"
(issuecomment-6020811285). An explicit triage ask on an issue goes to **slang-triager**, overriding the re-chase task's
"human comment → fixer" rule; I logged the exception. Triager `sess-1791304536740-1mhykc` posted comment 6022423678 at
18:06Z, reproduced at master `5cb03fa5f`:
- **Root cause is pass order:** `legalizeMatrixTypes` (slang-emit.cpp:2072) runs before the main
  `lowerBufferElementTypeToStorageType` (:2617), which already builds `_MatrixStorage_*_ColMajor` with transposing
  pack/unpack. LLVM runs buffer lowering first for this reason. Second gap: Khronos `shouldLowerMatrixType` (:2860).
- Also broken: bool matrices, std140 ConstantBuffer, square int3x3 (transposed elements), WGSL, GLSL, Metal.
- Single-member form dates to #7687 (v2025.13); the array regression is master-only.
- Recommended option 1 via moving the pass. Prototype P2 was incomplete (Metal SIGSEGV, bool storage fails spirv-val,
  GLSL unchanged); P1 broke 7 tests. Advised against option 2.

Memo: `inbox/a2a-1791310117663-c42qw9/triage-13446.md`. Fixer `sess-1791310101653-q7uc6d` (-13446 thread) held the memo
and P2 diff as context only.

## Maintainer follow-ups (10-15)

- **00:55Z, two questions** (6181868795: float too?; 6181881584: SPIR-V only?). Sent to the triager pinned `1mhykc`. The
  triager thread held two unanswered inbound rows and send_message refused without `in_reply_to`: pass the newest.
- **01:46Z, answered** in comment 6182493567 at master `0b8d2df75`. Float is unaffected everywhere (decorations on
  SPIR-V, `layout(row_major)` on GLSL, `_MatrixStorage` on WGSL/Metal/CUDA). Int is wrong on SPIR-V (direct and via
  GLSL, runtime) and on GLSL/WGSL/Metal (emitted); correct on HLSL/DXIL, CUDA, CPU. Square int3x3 on Vulkan and Metal int
  buffers have matching offsets but rows in the wrong order. Correction to my own note: #13378 merged as `d81979f84` with
  no int test and no expected-failure entries, so there was nothing to clean up.
- **19:48Z, option 2 rejected** (comment 6200890390, no mention): *"Option 2 is not acceptable because we shouldn't
  ignore "column_major" keyword."* Option 1 by elimination. Relayed verbatim to the triager; my separate note released
  `q7uc6d` for a **draft** PR with behavioural acceptance (int/bool layouts on SPIR-V/GLSL/WGSL/Metal matching
  reflection, std430 + std140, members, arrays, square + 1xN shapes), its own Vulkan value test, approach open to
  redirect. No `<github-post-authorized />` (no mention).
- Re-chases r1 (23:00Z) and r3 (10-16 06:23Z, the cap) found the fixer working but no PR; the chain was parked.

## 10-16 scares that turned out wrong

- **06:27Z, "GitHub auth broken fleet-wide".** `gh`/`git` returned `Bad credentials` and I cited `gh api rate_limit` →
  `app_not_connected` as a symptom. By 07:32Z REST and GraphQL reads worked; `rate_limit` always fails through this
  gateway ([[feedback_gh_auth_status_misleading]]), so citing it was wrong.
- **07:53Z, operator: no GPU passthrough ~09-28 → 10-16.** That contradicted the fixer's earlier "L40S" claims, so I had
  both re-measure. Triager (07:55Z) and fixer (09:08Z) re-ran on L40S `GPU-31e19808…` (no lavapipe): master int 12/12
  wrong, branch 0/12, float unchanged; 27 new legs fail on master; `tests/language-feature/matrix/` 44/44.

## Draft PR #13699 and review

- **09:25Z, opened:** `fix/issue-13446` @ `80c6453e37`, 8 commits, +611/−50, `pr: non-breaking`, closes #13446,
  mapped to `q7uc6d`. Issue update comment 6212398869. Float `bit_cast` fix in its own commit `41146f2d32`.
- **R1 (11:16Z / 12:01Z) @ `80c6453`, REQUEST_CHANGES:** moving `legalizeMatrixTypes` later caused 4 regressions vs
  master — swizzled store into a buffer matrix row crashes on 4 targets; invalid WGSL CB row read; WGSL shift amount stays
  signed; int matrix `/` fails on Metal/WGSL. Clarity review independently found 3 of 4 plus a FileCheck guard that can
  never fail. Suite 10895/10913, all 18 failures pre-existing.
- **R2 (14:30Z) @ `e37c6ce`, REQUEST_CHANGES:** R1 items fixed and revert-checked; new crash storing a whole row into a
  `column_major` one-column int/bool matrix (`int3x1`, `buf[0].a[1] = 50`) on SPIR-V/GLSL/WGSL/Metal. Reviewer attached
  a tested 3-line fix. Last round (review capped at 2).
- **14:54Z, fixed** at `e1d6780` (18 commits): F1–F4 + N1, each with a failing-without-fix test; 721/721 on L40S.
