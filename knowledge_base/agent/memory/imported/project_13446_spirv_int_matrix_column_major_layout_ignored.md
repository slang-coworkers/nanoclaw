---
type: project
name: project_13446_spirv_int_matrix_column_major_layout_ignored
description: "slang#13446 (bot-filed 10-05 ~20:10Z by slang-fixer on the #13378 chain): on SPIR-V, legalizeMatrixTypes lowers int/uint/bool matrices to row vectors regardless of layout while reflection honours column-major -> silent wrong value on Vulkan. The array form is the FOURTH #12992 regression. Maintainer A/B fix choice; owned by the #12992 chain; NO fixer dispatched; covered by rechase-13376-13375-05dc. 10-06 16:32Z jkwak-work asked @nv-slang-bot to triage; dispatched to slang-triager; triaged 18:06Z (cmt 6022423678, rec option 1 via pass order); waits on jkwak-work; 10-15 jkwak-work asked float-too? + SPIR-V-only?; answered 01:46Z cmt 6182493567 (float fine everywhere; int wrong on SPIR-V/GLSL/WGSL/Metal). 10-15 19:48Z jkwak-work rejected option 2 -> option 1; triager releasing fixer q7uc6d for a draft PR; re-chase rechase-slang-13446-r1-6def."
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

**10-15 00:55Z: two follow-up questions from the maintainer.** No option was picked; these are questions, not a
go-ahead.
- Comment 6181868795: is it limited to int/bool, or does float have it too?
- Comment 6181881584: is it limited to SPIR-V, or do other targets have it too?

I added 👀 to both and sent both to slang-triager, pinned to `1mhykc` on the -13446 thread with in_reply_to 46 and
post-authorized, to be answered in one reply. The brief asks for a single matrix covering float vs int/bool across every
target, buffer kind and shape, checked at HEAD, with the evidence for each cell (emitted code inspected vs. run).
- **Background:** `i13446-decision-gate-162d` is gone (removed when the recurring per-issue gate was retired under R10,
  10-13). #13378 merged at 22:41Z on 10-14, so the cleanup in comment 6002335255 now applies to master.
- **Timer:** `rechase-13446-float-targ-4206`, a one-shot at 03:00Z 10-15. It checks for the reply, nudges once, then
  alerts.
- **send_message hazard:** the triager thread held 2 unanswered inbound rows (#42, #46), and send_message refused to send
  without `in_reply_to`. Pass the newest one.

**10-15 01:46Z: both questions answered.** slang-triager posted comment 6182493567, measured on master `0b8d2df75`.
- **Float:** not affected on any target. Readbacks match reflection on lavapipe (direct and via GLSL) and on CPU. Other
  targets were checked from emitted output. The mechanism differs by target: decorations on SPIR-V, `layout(row_major)`
  on GLSL, `_MatrixStorage` on WGSL, Metal and CUDA.
- **Int:** wrong on SPIR-V direct and via GLSL (runtime), and on GLSL, WGSL and Metal (emitted). Correct on HLSL/DXIL and
  CUDA (offsets checked) and on CPU (run). Square int3x3 on Vulkan and Metal int buffers have matching offsets but rows
  in the wrong order.
- **Two side findings, unfiled, for the operator to decide:** (a) LLVM ConstantBuffer reads disagree with reflection for
  any struct, including ones with no matrix. (b) Reflection gives `column_major bool2x3` 6 bytes on CPU but 24 on
  LLVM/SPIR-V.
- **Correction of my 10-15 00:58Z note:** #13378 merged as `d81979f84` with **no** int test and **no** expected-failure
  entries; comment 6002335255 was already edited on 10-12 to say so. There is nothing to clean up. The fix has to add its
  own Vulkan value test.

I cancelled `rechase-13446-float-targ-4206` because the question was answered. Waits on jkwak-work choosing option 1 or
2. No timer is armed: the maintainer's next comment arrives as a webhook, and the fixer stays on hold.

**10-15 19:48Z: the maintainer rejected option 2.** jkwak-work wrote in comment 6200890390, with no bot mention: *"Option 2
is not acceptable because we shouldn't ignore "column_major" keyword."* The triage offered only options 1 and 2, so option
1 is chosen by elimination. They didn't comment on the pass-order approach or ask for a PR.

I added 👀 and relayed the comment word for word to slang-triager, pinned to `1mhykc` with in_reply_to 88. My note, kept
separate from the quote, told the triager to release held fixer session `q7uc6d` for a **draft** PR:
- **Acceptance:** behaviour, not a particular implementation. int/bool buffer matrices must honour the layout on
  SPIR-V/GLSL/WGSL/Metal, matching reflection in offsets and element order, for std430 and std140, single members,
  arrays and square shapes.
- **Open items from P2:** the Metal SIGSEGV, bool storage, GLSL text output.
- **Test:** its own observed Vulkan value test.
- **Approach:** stated as open to jkwak-work redirecting it on the draft.

No `<github-post-authorized />`, because there was no mention. The draft PR is the artifact. **Timer:**
`rechase-slang-13446-r1-6def` at 23:00Z 10-15 (task-hygiene r1 of 3).
- **10-15 19:55Z: handed off.** The triager released fixer `q7uc6d` (its msg 21) with the memo and
  `scratch-13446-shaders.tgz`. The brief keeps the lavapipe slang-rhi tweak local-only and adds a 1xN shape to the open
  items. When the fixer reports the PR number, the triager posts a fresh 5-bullet on #13446 and reports to me.
- **10-15 23:00Z: r1 re-chase.** No PR yet, and the fixer is working. At 22:55Z `q7uc6d` reported the fix works locally: 12/12 Vulkan probes match reflection and float output is unchanged. The triager answered at 22:55Z that the float `bit_cast` change needs its own commit with a failing-on-master test, a description line and a process-report entry. Both sessions are cost status=ok. No nudge was sent. `task-hygiene next` returned **r3** (count 2/cap 3), so I scheduled `rechase-slang-13446-r3-3cd8` for 03:00Z 10-16 as the **last** re-chase. On no-PR it parks the chain and tells the dashboard.
