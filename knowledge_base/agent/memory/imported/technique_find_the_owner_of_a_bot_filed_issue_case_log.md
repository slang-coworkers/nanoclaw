---
type: technique
name: technique_find_the_owner_of_a_bot_filed_issue_case_log
description: "Dated evidence for the bot-filed-issue owner ladder (2026-10-08..10-17): which rung found the owner for #13531, #13533, #13560, #13580-#13582, slangpy#1223, #13628/#13629, #13656, #13682, #13683, #13727, #13729/#13730, and what resume path was armed. Split from technique_find_the_owner_of_a_bot_filed_issue_before_dispatching on 2026-10-17."
metadata:
  node_type: memory
  type: technique
---

# Owner-ladder case log

Evidence behind each rung of [[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]].
The rules distilled from these live there; this file only records what happened. Gates named
`iNNNNN-*-gate` were recurring tasks, armed before the 2026-10-13 no-recurring-per-issue rule.

- **#13531 (10-08), rung 8 inside the 5-min cap.** The triager's filing report reached the sibling
  Main (#13529 session) at 20:08:08Z; its 5-bullet at 20:09:43Z already said "No fixer unless a
  maintainer asks". Dispatched nothing; armed `i13531-maintainer-gate` (reuses
  `i13433-decision-gate.sh` with `GATE_ISSUE`/`GATE_SINCE`).
- **#13533 (10-08), rungs 7 then 8.** CUDA reflection side finding of #13530. Triager `[Filed]`
  20:44:55Z; sibling 5-bullet 20:46:23Z ("the #13530 chain owns it"). The sibling armed no gate, so
  I added `i13533-maintainer-gate`; five controls passed.
- **#13560 (10-10/10-13), rung 8 timed out.** Triager's report (01:05:15Z) ended "routing is your
  call" and went to the dashboard Main (`9fon2n`), which did not answer in ~12 min. Low-priority
  missing-diagnostic question, so I dispatched nothing and armed `i13560-maintainer-gate`. On 10-13
  jkwak-work asked "Is this dup to #13323?" as a webhook; I cancelled the gate and routed the
  question to slang-triager session `ll0lo2` (#13321 thread). My unverified note: they share a
  backstop but #13560 never reaches E38037, so likely related, not duplicates.
- **#13580 / #13581 (10-12), rung 1 on the PARENT #12737.** `--limit 2000` and `--limit 3000`
  found only re-chase sessions; the 08-25 owner sessions sit past row 3000 of ~6900.
  `--agent-group <triager-gid> --limit 5000` found them. Both the triager and the parent Main left
  routing to the per-issue sessions, so this session decided: no fixer (#13581 overlaps
  maintainer-owned #11088) and armed `i13580-`/`i13581-maintainer-gate`.
- **#13582 (10-12), rung 7 hit, rung 8 timed out.** slang-fixer filed it at 21:22:28Z on
  jkwak-work's #13378 R7 order ("this PR should stay away from `in/out/inout`"). The dashboard Main
  was busy with #13580/#13581, so this session armed `i13582-maintainer-gate` and reported.
- **slangpy#1223 (10-15), rung 3.** Nothing named #1223. `grep -l "query exhaustion"
  conversations/` found my 10-02 conditional order to slang-ci-babysitter ("file once a 3rd
  post-fix occurrence lands, aimed at skallweitNV"); #13626's 10-14 hit was the third. Dispatched
  nothing; reported to the operator.
- **#13628 / #13629 (10-15), rungs 7 then 8 in ~80 s.** The #13537 merge follow-ups, filed 06:30Z
  on the dashboard Main's 05:50Z order. Fixer `[Report]` 06:31:36Z (newest row of its
  `gh-issue-…-13537` session); dashboard 5-bullet 06:32:53Z ("maintainers triage and assign"). It
  also cancelled `rechase-pr13537-decision-4f69`, leaving the filed `regression` unwatched, so I
  armed one `--process-after` re-check, `i13628-triage-recheck` (trigger: a release newer than
  v2026.19 containing `a5a87a1236`).
- **#13656 (10-15), the filing order named the owner.** The #13639 Main ordered "file-only, I'll
  route it afterwards; its webhook will come back as a self-echo, and this session owns it". Rungs
  7/8 found the `[Report]` (14:34:55Z) and the sibling's Decision 3 5-bullet (14:35:23Z). I
  extended `rechase-13639-pr13646-cdc2` with a Decision 3 branch instead of arming a new task.
- **#13682 (10-15), rung 6 + timeline.** G1 of slang-reviewer's #13669 R1 verdict. A 3-min poll of
  fixer session `gj2lyx` showed no report, but the timeline had a `cross-referenced` event from
  #13669 (20:24:19Z) and the PR body's Risk line cited #13682. Dispatched nothing, sent nothing.
- **#13683 (10-15), timeline after a timed-out poll.** Filed 21:46Z on the #13631 thread with the
  reviewer's agreement. No `[Fix Report]` in a 5-min poll; then a `referenced` event (21:53Z) from
  #13659's commit `c136bcb`. Dispatched nothing.
- **#13727 (10-17), rungs 1 (parent) + 6.** The body says "it will be committed to #13700 with
  this issue's number"; rung 1 on #13685 found slang-fixer's live session, and pdeayton-nv's
  round-4 point 2 (issuecomment-6228037888) offered "explain why this belongs in a follow-up
  issue". No `[Report]` or timeline reference after 5 min, so I folded #13727 into
  `recheck-slang-13700-main-9dbe` (10-19 09:00Z) with `ncl tasks update`.
- **#13729 / #13730 (10-17), rungs 0, 1, 7 then 8 inside 3 min.** slang-triager filed both at 06:52Z
  as side findings of #13687, on the #13687 Main's close-out order. Its `[Triage Resolution]` (06:54Z)
  ended "Neither issue is routed to a fixer; that's your call", and the #13687 Main's 06:55Z
  5-bullet said the per-issue Main sessions own the routing. So this session decided for #13729: no
  fixer yet, because the fix must cover the shared-helper shape that draft #13726 adds. I folded it into
  `chase-13726-ready-7233` (15:45Z) with `ncl tasks update`, as a second operator question. ⚠️ Two
  sibling sessions (#13729 and #13730) can each fold into the same task. Each `update` replaces the
  whole prompt, so read it again just before writing and append to it. Never write back a copy read earlier.
- **#13729 / #13730 (10-17), rung 7 then rung 8 inside 1 min.** Both filed by slang-triager closing out
  #13687; its resolution said routing was our call and the #13687 Main left it to the per-issue sessions.
  Both held behind draft #13726 (same code path). The #13729 session folded its question into
  `chase-13726-ready-7233`; the #13730 session waited for that write, then appended a third question to the
  same task instead of arming a second one.
