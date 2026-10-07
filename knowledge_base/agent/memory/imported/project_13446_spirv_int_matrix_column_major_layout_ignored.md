---
type: project
name: project_13446_spirv_int_matrix_column_major_layout_ignored
description: "slang#13446 (bot-filed 10-05 ~20:10Z by slang-fixer on the #13378 chain): on SPIR-V, legalizeMatrixTypes lowers int/uint/bool matrices to row vectors regardless of layout while reflection honours column-major -> silent wrong value on Vulkan. The array form is the FOURTH #12992 regression. Maintainer A/B fix choice; owned by the #12992 chain; NO fixer dispatched; covered by rechase-13376-13375-05dc. 10-06 16:32Z jkwak-work asked @nv-slang-bot to triage; dispatched to slang-triager; triaged 18:06Z (cmt 6022423678, rec option 1 via pass order); waits on jkwak-work; gate i13446-decision-gate-162d."
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

**10-06 16:32Z: maintainer asked for triage.** jkwak-work self-assigned the issue at about 20:45Z on 10-05, with the Q4
milestone. At 16:32Z on 10-06 they commented "@nv-slang-bot can you triage this issue?" (issuecomment-6020811285). I added
👀 and dispatched it to **slang-triager** on `gh-issue-shader-slang/slang-13446` with `<github-post-authorized />`. The
triager owns the single GitHub reply; I posted no TODO comment. The re-chase task's standing rule sends a human comment
here to the fixer, but this was an explicit request for triage on an issue, so it went to the triager per CLAUDE.md's
routing. I recorded that exception in `rechase-13376-13375-be74`, which nudges the triager once if nothing has posted
after 2h. The brief tells the triager that the fixer's claims are unverified (the offsets and the value 11 were worked out
statically) and that the A/B fix choice stays with the maintainer.

**10-06 18:06Z: triaged.** slang-triager (session `sess-1791304536740-1mhykc`) posted comment 6022423678, approved by
OUTPUT_REVIEW. Every claim in the body reproduced at master `5cb03fa5f`. The value 11 is real GPU output (CI run 37360827212,
vk leg). It refines the root cause to **pass order**: `legalizeMatrixTypes` (slang-emit.cpp:2072) runs before the main
`lowerBufferElementTypeToStorageType` (:2617), which already builds `_MatrixStorage_*_ColMajor` with transposing pack and
unpack. LLVM runs buffer lowering first for this reason. A second gap is the Khronos `shouldLowerMatrixType` (:2860).
- **Also broken:** bool matrices, std140 ConstantBuffer, square int3x3 (transposed elements), WGSL, GLSL and Metal.
- **History:** the single-member form has existed since #7687 (v2025.13). The array regression is on master only.
- **Recommendation:** option 1's outcome, by moving the pass. Prototype P2 was reverted and is incomplete: Metal SIGSEGV,
  bool storage fails spirv-val, GLSL unchanged. P1 (an early extra buffer-lowering run) broke 7 tests. It recommends
  against option 2.

The memo is at `inbox/a2a-1791310117663-c42qw9/triage-13446.md`. slang-fixer session `sess-1791310101653-q7uc6d`, on the
-13446 thread, holds the memo and the P2 diff as **context only** and waits for an explicit go. **Resume trigger:**
`i13446-decision-gate-162d` checks every 12h via `gates/i13446-decision-gate.sh`, firing on a non-bot comment after 18:06:51Z
or on close. Controls were proven: an earlier SINCE gives HUMAN_REPLY, closed #12990 gives CLOSED, and the live run gives
false. The #13446 entry was taken out of `rechase-13376-13375-be74`.
