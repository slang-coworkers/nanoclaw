---
type: chain-log
title: slang#14058 / PR #14209 — dated history
description: Dated readings of the #14058 chain (10-29 triage → 11-02 rescope to all discarded calls → draft PR #14209 → r1/r2 re-chases → 11-10 master merge). The current state, design and lessons are in the chain record. New dated entries are added here.
---

# slang#14058 / PR #14209 — dated history

Chain record (current state, design, lessons): [[slang/14058-metal-discarded-atomic-unused-variable.md]].
Add new dated entries **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.
Items marked "fixer-reported" or "triager's finding" were not re-run by Main.

## 10-29 — routing, triage, local fix

- **21:55Z routing.** `grep 14058 memory/slang/` had no hits. The only session on `gh-issue-shader-slang/slang-14058` was
  my Main webhook session `sess-1793310696129-4xjgxm`. Dispatched to slang-triager (msg 11, session
  `sess-1793310892825-g1df5o`). Flagged adjacent work: #14031 / draft #14044 (64-bit Metal atomic emit) and the #13771
  record (the same warning was seen there).
- **21:55Z triager interim (msg 14).** Reproduced on Metal (master 977df1246 era). GLSL and CUDA also bind the unread temp.
- **22:13Z [Triage] (msg 16; memo `/workspace/inbox/a2a-1793311988989-tbb812/triage-14058.md`).** bug / low / P2 /
  target-emit, no duplicate. Approach **A** recommended; C and D rejected (see the record). Main-verified 22:14Z: fixer
  `sess-1793311978024-uy6784` is running; the triager re-check task `t-944bbf` (`sess-1793311883377-amdgh1`) fires 11-02 22:00Z.
  Main-verified the #14044 collision: #14044 head f800a8e21 adds `emitAtomicCall(imageFunc, bufferFunc, bool returnsValue)`
  with a skip-decl path. The second PR to merge adapts. #14044's owner is fixer session `uqb9b4`.
- **23:36Z [Report] (triager msg 24, relaying the fixer; fixer-reported).** FIXED LOCALLY on `fix/issue-14058`, 3 commits
  on 977df1246. `tests/metal/atomic-unused-result.slang` passes 7/7 (2 metallib `-Werror` rows need macOS). The
  atomic+Metal corpus gives 477/477; the full suite 11307/11310 (3 `fp8-cuda` failures, same on master). HLSL/GLSL/CUDA/WGSL
  emit is unchanged. Revert drill: `hasUses()` fails the `-g` runs only. Main-verified: branch unpushed (404); resume task
  `system:tasks:slang-14058-resume-0060` exists.

## 11-02 — rescope to all discarded calls, draft PR

- **10:25Z reporter comment 6574800687.** The warning covers any discarded call result (user functions, `q.next()`,
  `frexp`, an explicit `(void)` cast): 15 of 41 warning files are non-atomic (32 warnings vs 347 for atomics). Forwarded
  verbatim to the triager at 10:28Z (pinned g1df5o, in_reply_to my webhook row).
- **10:31Z triager interim (msg 40).** Reproduced on master 6815ed82d on all six C-like targets.
- **10:48Z [Report] (msg 42): WIDENED** to discarded non-void call results (design in the record). Rescope memo: triager
  `memory/issues/triage-14058-rescope.md`. Fallback if the call path grew: atomics ship as "Part of #14058" first.
  Main-verified 10:49Z: the fixer received the handoff.
- **13:28Z [Report] (msg 48; fixer-reported).** Widened fix done locally, 5 commits on 6815ed82d (16b1ab9b3 atomics test,
  98fb8e210 `hasNonDebugUse`, 701fb4730 Metal atomics, db2a43f84 call test, 993ef6c78 `tryEmitDiscardedCallStmt`).
  `tests/metal/unused-call-result.slang` passes 15/15. Full suite 11383/11386 (the same 3 `fp8-cuda`). 5378 files compiled
  for 6 targets with and without `-g`: WGSL output is byte-identical, and the other diffs only drop `T _Sn = ` or add `(void)`.
- **22:29Z [Report] (msg 50): DRAFT PR #14209** @ 315e95a52, created 22:14:33Z by app/nv-slang-bot, `Fixes #14058`,
  `pr: non-breaking`. Draft CI: 3 pass, 53 skipping. Issue: `reproduced`, Type=Bug; fixer status comment 6590012034; the
  triager's reply 6590092293 answered 6574800687. `t-944bbf` cancelled. Reviewer `sess-1793658353934-9r1jbl` started R1.
  The pr-mapping went to the one-shot task session `sess-1793316915418-fejlik`, not `uy6784` (first-claim-wins).
  22:36–22:38Z: a #14044 overlap note was queued for the PR body's Risk line. This was my suggestion, not a maintainer ask.

## 11-03 — review, park, side find #14216

- **00:42Z [Triage Resolution] (msg 60; fixer [Fix Report] msg 62).** Head 8d9dd07cc. The Risk line names #14044 and
  #14170. Assignee and reviewer: jkwak-work. Reviewer APPROVE_WITH_NITS (0 bugs; G1, G2, N1–N6 applied; codex approves;
  G3 open: the metallib `-Werror` lanes have never run). Fixer-reported: new tests 23/23; regression subset 1858/1859
  (a `texture-simpler` cuda test-server flake that passes alone). PARKED. 1st un-draft ask to the dashboard at 00:46Z.
  Timer `rechase-slang-14058-r1-1d3f` was set for 11-05 16:00Z.
- **00:45–00:48Z side find S1 → filed as #14216** (triager msg 70/72). The dedupe was clean (closest: SPIR-V-only
  #13841/#13842, closed #11682). Master-only repro on 7f506f4c9. Filed by app/nv-slang-bot at 00:47:47Z, `reproduced`,
  Type=Bug, filed-only.

## 11-05 — #14216 held, re-chase r1

- **#14216:** jkwak-work labeled it `DebugInfo` and set milestone Q1 2027 (Winter) (11-04 17:18Z), then self-assigned it at 17:35Z.
  The operator asked for triage (dashboard msg 38). Answered directly: IR→emit debug-info pipeline, low/P3, held for the
  assignee. Main-verified the `stripDebugInfo` gate at slang-emit.cpp:1096-1101 (7f506f4c9).
- **16:00Z r1: no change.** #14209 is a draft at 8d9dd07cc with 0 reviews and only bot comments. It is MERGEABLE but 23
  commits behind. CI run 41552378383 is waiting at the priority-yield gate. #14044 and #14170 are unmerged. There was no
  operator answer to the 1st ask, and no 2nd ask was sent: the weekly-list policy (11-03) applies, and supervisor-state
  already lists #14209. Timer r2 `rechase-slang-14058-r2-b5ea` was set for 11-10 16:00Z.

## 11-10 — re-chase r2, master merged

- **16:00Z r2: ACTION.** #14209 was **CONFLICTING** because of #14210 (Metal float atomics, fixes #14060), merged
  11-05 21:53:54Z. Reporter comment 6697870033 (11-06 22:57Z) asked for a rebase and the macOS lanes, and offered an
  Apple `metal -Werror` run on the 41 files. It had no reply, because its webhook (seq 46) went to `fejlik`, which had
  been closed since 11-03. Relayed verbatim to the triager (msg 27, pinned g1df5o, in_reply_to=2). The ask: merge master
  with a merge commit and answer on the PR. Dashboard msg 37: a remap to `uy6784` was offered. The 11-09 weekly list
  (seq 511974) had no answer naming #14209. No r3 timer was set, because there was human activity.
- **16:04Z triager [Report] (msg 74).** Handoff landed as seq 30 in `uy6784` (running). No new fixer session was minted.
- **16:13Z triager [Report] (msg 80): MASTER MERGED, REPORTER ANSWERED.** Main-verified 16:15Z: head `e6a5574e1`, a merge of
  8d9dd07cc + master 4f66408b3, no force-push, MERGEABLE. Reply 6772529363 (16:12:10Z). The pr-mapping was re-claimed by
  `uy6784` at 16:12:53Z, so the dashboard 512170 remap offer is moot (a one-line correction was sent). Fixer-reported: only
  the `AtomicLoad` hunk conflicted; #14210's float path was kept with the gate on top; 67/67 on the L40S (22 vk/cuda GPU
  runs); #14210's float tests pass 4/4. CI run 42851886083 is at the priority-yield gate.
