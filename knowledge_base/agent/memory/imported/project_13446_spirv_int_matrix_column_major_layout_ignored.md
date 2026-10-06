---
type: project
name: project_13446_spirv_int_matrix_column_major_layout_ignored
description: "slang#13446 (bot-filed 10-05 ~20:10Z by slang-fixer on the #13378 chain): on SPIR-V, legalizeMatrixTypes lowers int/uint/bool matrices to row vectors regardless of layout while reflection honours column-major -> silent wrong value on Vulkan. The array form is the FOURTH #12992 regression. Maintainer A/B fix choice; owned by the #12992 chain; NO fixer dispatched; covered by rechase-13376-13375-05dc."
metadata:
  node_type: memory
  type: project
---

# slang#13446: SPIR-V integer-matrix buffer members ignore column-major layout

**Origin.** Found when #13378's `-g0` narrowing (a8f62f4) let the `.2/.3 (vk)` legs of
`tests/language-feature/types/matrix-layout-array-coerce.slang` reach FileCheck: `output[14]` was 11, expected 8 (CI run
37360827212). slang-fixer session `sess-1790885152461-qoc687` (thread `gh-issue-shader-slang/slang-13376`) confirmed that a
plain read without `inout` is already wrong on master (msg 81, 20:01Z). The filing followed the #12992-chain Main's order
(`sess-1790881765830-saa1xb`, thread `-13375`, row 733, 20:02Z): label it `regression`, give the maintainer both fixes to
choose from, and put "silent wrong value" in the title. Siblings: #13443 and #13444.

**Content.** `legalizeMatrixTypes` (`slang-ir-legalize-matrix-types.cpp:77-104`) lowers every int/uint/bool `matrix<T,R,C>`
to `vector<T,C>[R]` at std430 stride 16, and the layout is lost. Reflection puts `k` at 24 and SPIR-V at 32, while
`float2x3` gives 24/24. The single-member form has been wrong since v2026.13.1 or earlier. The `column_major` array form
under the row-major default was 64/64 on v2026.19 and has been 48 vs 64 since `a459ba415b`, so it is a #12992 regression.
The fix is a maintainer choice: (1) lower to column vectors when the layout is column-major, or (2) have reflection report
the row-vector layout. Related: #13382 (two producers disagree about orientation).

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook was the filing echoing back. The owner ladder hit
on rung 7 (fixer row 81 plus Main row 733). On rung 4, `rechase-13376-13375-05dc` (fires 21:30Z 10-05) covered the chain
but did not name #13446. I extended it with `ncl tasks update` (20:1xZ), adding #13446 to its routing and watch list. The
fixer's next step was to split the int sub-case into its own test file citing #13446, then send a `[Fix Review Request]`.

**Resume path.** A non-bot comment on #13446 routes verbatim to slang-fixer pinned `qoc687` on
`gh-issue-shader-slang/slang-13446`. The re-chase task asks whether the triager or fixer should take #13443, #13444 and
#13446 once #13378 is green.
