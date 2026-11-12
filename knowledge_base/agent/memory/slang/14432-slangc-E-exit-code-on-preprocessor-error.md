---
type: chain
title: slang#14432 — slangc -E returns exit code 0 when the preprocessor reports an error
description: Maintainer (jkwak-work) self-filed and self-assigned 11-10 02:44Z; asked the bot to triage + make a PR (02:50Z); parked 03:15Z on #14422; #14422 merged 07:58Z and tick 337 woke fixer h1x8f6 at 12:13Z to open the draft PR.
tags: [slangc, preprocessor, exit-code, maintainer-owned, merged, terminal]
---

# slang#14432 — `slangc -E` exits 0 after a preprocessor error

**11-10 02:44Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned`, 02:44:32Z), 0 labels, 0 comments.

**Ask.** In `-E` mode the `PreprocessorOutput` branches in `slang-end-to-end-request.cpp` and
`slang-compile-request.cpp` return `SLANG_OK` before the sink error-count check, so E15405 / E15408 still exit 0.
When fixed, `tests/preprocessor/preproc-pound-pound-1.slang` and `preproc-detail-2.slang` must move from
`exit-code=0` to `-1`. Open question for a maintainer: is exit 0 intentional for tools that read `-E` output.
Follow-up of [#14266](14266-diag-tests-exit-code.md) (same author, same exit-code class as
[#14292](14292-slang-test-exit-code-all-test-types.md)).

**Disposition: held, nothing dispatched or posted.** Rung 4: a maintainer filed and self-assigned the work and
asked the bot for nothing. Mentions arrive as webhooks, so no re-check timer.

**11-10 02:50Z — RESUMED.** jkwak-work [comment 6757575242](https://github.com/shader-slang/slang/issues/14432#issuecomment-6757575242)
(MEMBER, verified via API): "@nv-slang-bot triage and make a pr". Dispatched slang-triager on
`gh-issue-shader-slang/slang-14432` with `<github-post-authorized />`; the ask covers the PR, so the triager hands
off to slang-fixer (draft PR; flip the two `exit-code=0` tests to `-1`; the issue's open question on intentional
exit 0 goes in the PR/triage post for jkwak-work). No prior triager/fixer session on this thread (only my Main
issue_opened session).

**11-10 02:58Z — triaged.** Triager report (receipts verified: bot comment
[6757698268](https://github.com/shader-slang/slang/issues/14432#issuecomment-6757698268), label `reproduced`,
Type=Bug). Bug / P2 / frontend. Reproduced on 72170828a. E15405, E15408, `#error` and `-warnings-as-errors` all
exit 0 under `-E`. Root cause: `slang-compile-request.cpp:827-831` returns `SLANG_OK` before the sink check at
:833. Approach A, the producer fix, moves the error check above the `-E` return. The behavior chosen for
jkwak-work to confirm: "-E output is kept; exit -1 on any error" (gcc/clang behave the same way). Scope beyond the
issue text: line 2 of both tests (`filecheck=`) also needs `exit-code=-1`, and
`tests/bugs/preproc-lex-failure-2.slang.expected` is a third affected test. **Overlap:** open PR #14422
(jkwak-work, non-draft, "slang-test: check the exit code of diag= and .expected tests") edits line 1 of the same
two tests, so the PR that lands second must merge master. Handed to slang-fixer on the canonical thread. Raw:
[raw/triage-14432.md](raw/triage-14432.md).

**11-10 03:15Z — PARKED on #14422.** jkwak-work [comment 6757952750](https://github.com/shader-slang/slang/issues/14432#issuecomment-6757952750)
(verified; it does NOT @-mention the bot): "The \"exit-code\" behavior is based on the following PR: #14422. Please resume
the work after the PR is merged." At 03:16Z I relayed it verbatim to the slang-fixer owner session
`sess-1794279477634-h1x8f6` (pinned + `in_reply_to=18`; it landed as fixer seq 6). The fixer must stop: no push, no PR,
keep `wt-slang-14432`. The relay carries no post authorization. #14422 at 03:15Z: open, non-draft,
`mergeable_state: behind`. **Timer:** one-shot task `recheck slang 14432 after 14422`, process-after
2026-11-11T03:30Z. If #14422 has merged, wake the fixer pinned. If it is still open, schedule one more one-shot.
If it closed unmerged, escalate to the dashboard.

**11-10 03:20Z — fixer confirmed the park.** Local-only `fix/issue-14432` in `wt-slang-14432`, 2 commits: `ced7d3c0c`
(repro `tests/preprocessor/preproc-only-error-exit-code.slang`) and `5c183c575` (fix + test expectations). Tests:
preprocessor/ + bugs/ 1071/1071. Full suite 12013/12016; the 3 failures are the known `fp8-cuda*` failures, also
seen on #14295. Nothing pushed or posted. Resume checklist: the fixer's `memory/fix-14432.md`.

**11-10 12:13Z — RESUMED by supervisor tick 337.** #14422 merged 07:58:27Z (jkwak-work, merge `500e75be8f`), so
jkwak-work's "resume the work after the PR is merged" condition was met ~4 h before anyone acted (the one-shot timer
was set for 11-11 03:30Z). Woke the fixer pinned (`target_session_id=h1x8f6`, `in_reply_to=23006`, thread
`gh-issue-shader-slang/slang-14432`, `<github-post-authorized />` from the 02:50Z "triage and make a pr" mention);
landed as fixer seq 10. Cancelled one-shot `recheck-slang-14432-afte-6765`. Next: fixer opens the draft PR.

**11-10 12:15Z.** Fixer acked the resume: merged master `500e75be8` (#14422), set the tests to #14422's exit-code rules, and is rebuilding (ETA 15 min). Next: the draft PR.

**11-10 12:33Z — draft PR [#14438](https://github.com/shader-slang/slang/pull/14438)** "Fail slangc -E when preprocessing
reports an error". Verified: draft, `fix/issue-14432` @ `ba506b4d7`, label `pr: non-breaking`, body references #14432.
pr-mapping → fixer `sess-1794279477634-h1x8f6`. Explanation HTML: [raw/pr14438-explanation.html](raw/pr14438-explanation.html).
Next: the fixer's review cycle. The ready-flip is pending and goes on the weekly list (no per-PR undraft ask). Reviewer: jkwak-work.

**11-10 12:41Z — fixer report.** Receipts verified: explanation comment [6767577604](https://github.com/shader-slang/slang/pull/14438#issuecomment-6767577604),
issue status comment [6767583494](https://github.com/shader-slang/slang/issues/14432#issuecomment-6767583494), and CI run
42816770741 on `ba506b4d7`, which was `waiting` at 12:41Z. Tests: 1072/1072 in the preprocessor and bugs dirs. Full suite
12041/12044; the 3 failures are the known `fp8-cuda*` `CUDA_ERROR_INVALID_PTX` tests. The PLAN, CODE and OUTPUT_REVIEW
critiques approved. The `diag=` lines use #14422's default (-1), the `filecheck=` lines say `exit-code=-1`, and the
`.expected` result code is -1. The PR body asks jkwak-work to confirm the open question (keep the `-E` output and exit -1).
The peer review request went to slang-reviewer. Next: the [Fix Report] after the reviewer verdict.

**11-10 13:11Z — [Fix Report]: fixed, draft PR #14438, head `457a19b0c`** (verified on GitHub: draft; CI run 42821030082 on
457a19b `waiting`). slang-reviewer R1 returned APPROVE_WITH_NITS (0 bugs). The nits patch was applied verbatim as 457a19b,
and CODE_REVIEW approved the new head, so there is no second review round. Full suite 12041/12044 at ba506b4, with the
known fp8-cuda failures. **Waiting on a human:** jkwak-work must confirm the open question in the PR body, and the
ready-flip goes on the weekly list. The fixer did not mark the PR ready.
**Side find S1** (from the reviewer): `-E -pass-through dxc|glslang` with `#error` exits 0 silently, at
`slang-end-to-end-request.cpp:219`. The filing policy allows filing it without asking. At 13:12Z I relayed it to the
triager owner session `l0dcol` (pinned, `in_reply_to=18`, landed as triager seq 6) to reproduce it against master and
#14438, check for duplicates, and file it if new. It is filed-only, with no fixer chain.

**11-10 13:20Z — S1 filed as [#14439](https://github.com/shader-slang/slang/issues/14439)** "slangc -E with -pass-through writes
no output and returns exit code 0, also after an error" (nv-slang-bot, label `reproduced`, 0 assignees, verified via API).
The `issue_opened` webhook needs no dispatch: the triager filed it for this chain, and it stays filed-only with no
fixer chain. Its open question (error for the option pair vs. preprocess in pass-through mode) is for a maintainer.

**11-10 13:21Z — side finds filed** (verified). [#14439](14439-slangc-E-pass-through-exit-code.md): `-E -pass-through`
exits 0, and #14438 does not fix it. [#14440](14440-pass-through-glslang-spirv-e99997.md): `-pass-through glslang -target spirv`
gives E99997. Both are filed-only and owned by this chain, and their issue_opened webhooks need no dispatch.

**11-10 18:32Z — jkwak-work reviewed and marked #14438 READY** (verified: `draft:false`, review COMMENTED 18:32:41Z).
The maintainer flipped it, so it drops off the weekly un-draft list. The maintainer also requested reviews from the
dev team and dshreiner-nv. Inline [r4528913191](https://github.com/shader-slang/slang/pull/14438#discussion_r4528913191):
"Remove this test" (the new `preproc-only-error-exit-code.slang`). **18:45Z — fixer round 2:** commit `5ec21e441`
removes that file. The fix and the 3 updated tests stay. preprocessor/ + bugs/ 1068/1068. CI run 42877029623 is
dispatched. The fixer acked and replied on the thread and left it unresolved for jkwak-work. The PR body, the
explanation ([raw r3](raw/pr14438-explanation-r3.html)) and the issue status comment are refreshed. `mergeable_state:
behind`. Still open: jkwak-work's confirmation of the `-E` exit -1 behavior. Next: human review / merge.

**11-10 23:06Z — approver webhook NOT forwarded.** `pr_ready_for_review` (synchronize, head `5ec21e441`) reached Main;
slang-pr-approver is `paused=1`, so it was queued in `data/approver-pause-queue.md` instead. CI at that point: 57 pass,
1 pending, 0 fail. Later events for #14438 get only the `paused` check.

**11-11 00:36Z — MERGED, TERMINAL.** jkwak-work merged #14438 as `9efe5f8ad` (head 5ec21e4). #14432 closed as completed
at 00:36:34Z (verified). The fixer removed the worktree and the sentinel and edited the issue status comment to its final
state. S1 is already filed as [#14439](14439-slangc-E-pass-through-exit-code.md) (still open, filed-only). The fixer's
00:38Z report still lists S1 as unrouted; that line is stale, and no action is needed.

**11-11 18:40Z.** The triager closed its side of the chain ([Triage Resolution]: fixed, nothing more posted, sentinel removed). Side finds #14439/#14440 are now sub-issues of umbrella [#14459](14459-remove-pass-through-mode-umbrella.md), which jhelferty-nv asked for on #14440. A sibling Main session handled that.
