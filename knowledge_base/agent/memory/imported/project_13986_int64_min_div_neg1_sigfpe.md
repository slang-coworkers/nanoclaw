---
type: project
name: project_13986_int64_min_div_neg1_sigfpe
description: "slang#13986 (nv-slang-bot, filed 10-28 18:34:40Z by slang-triager from the #13978/#13984 fixer side finding): slangc SIGFPE (exit 136) constant-folding 64-bit INT64_MIN / -1 and % -1 — IR SCCP evalDiv/evalRem (slang-ir-sccp.cpp:660/:670) and front-end tryConstantFoldExpr CASE(/)/CASE(%) (slang-check-expr.cpp:2744-2755, also folds uint64 signed). Own fix chain; slang-fixer session 6cxhqb on gh-issue-shader-slang/slang-13986 since 18:36Z; draft PR #13991 @497b797. 11-04 18:58Z assignee jhelferty-nv: \"we shouldn't fold these\" (diagnostic optional, warn-vs-error undecided) — relayed verbatim to 6cxhqb 19:01Z; 11-05, 11-07 and 11-09 still parked on the two questions to jhelferty-nv (fixer re-check 11-11 19:00Z). Sibling: #13985."
---

# slang#13986: SIGFPE folding INT64_MIN / -1 and % -1

**Origin.** Second of the two side findings slang-fixer (`3s6rec`, #13978 chain, draft PR #13984)
reported at 18:29Z; the #13973 Main told the triager (`79rk2o`) at 18:31:17Z to file both and hand
each to slang-fixer as its own chain. First finding: [#13985](project_13985_uint64_loop_trip_count_signed.md).

**Ownership.** issue_opened webhook landed 18:34Z in Main `sess-1793212493560-tjj767`. Owner ladder
rung 1 hit: **slang-fixer `sess-1793212588979-6cxhqb`** on the canonical thread (created 18:36Z).
Triage comment 6477413934 (nv-slang-bot 18:36:23Z, "handed to the automated fixer"). Dispatched nothing.

**Overlap.** Front-end `CASE(/)`/`CASE(%)` sits next to #13975/#13984 edits in `slang-check-expr.cpp`;
related #13954 (no narrowing), #13545 (preprocessor `#if` same trap, draft fix covers only the preprocessor).

**10-28 20:28Z → 21:52Z:** draft PR #13991 (folds `INT64_MIN / -1` → `INT64_MIN`, `% -1` → 0; uint64 `/`/`%` unsigned).
R1 APPROVE_WITH_NITS, parked to rebase after #13984. Detail: [#13973 history](project_13973_builtin_call_constant_fold_history.md).

**11-04 18:58Z maintainer direction** ([6639348362](https://github.com/shader-slang/slang/issues/13986#issuecomment-6639348362),
jhelferty-nv, assignee; no @-mention): "Per Tess and Sami, we shouldn't fold these, just like we don't fold divide by zero.
We could also give a diagnostic … (unsure at first glance whether it's the error or warning)". It reverses #13991's
wrap-fold. Because our fixer owns the PR, the Main webhook session `tjj767` relayed it verbatim at 19:01Z (fixer row 28,
pinned `target_session_id` + `in_reply_to=8`; landed, session running). It made no GitHub post and no reaction. The
Orchestrator notes flagged: the diagnostic severity is the maintainer's choice; **#13994 says a scalar `OpSDiv %long INT64_MIN -1`
also traps spirv-opt `--ccp`**, so "don't fold" may only move the SPIR-V crash (the fixer checks first); uint64 part not addressed.
⇒ Rule: a non-summons maintainer comment on an issue whose **draft PR our fixer owns** is still relayed to that fixer
(internal only). The not-a-summons hold covers making no bot post/reaction, not withholding direction from the owner.

**11-04 19:19Z fixer [Report] (verified live):** note 3 reproduced. With SCCP declining the fold, `sccp.slang -target spirv`
(-O1) still exits 136, now in spirv-opt `const_folding_rules.cpp:2242`; -O0 and the other targets compile. The fixer posted
question comment [6639852932](https://github.com/shader-slang/slang/issues/13986#issuecomment-6639852932) to jhelferty-nv:
(1) diagnostic none/warn/error? An error like E30002 in SCCP stops the crash before spirv-opt runs. (2) Should 32-bit `INT_MIN / -1`
also stop folding? It keeps the uint64 part. #13991 is unchanged @497b797. The fixer set its own one-shot re-check for 11-05 19:00Z
(its claim; Main cannot list peer tasks). The plan is in the fixer's `reports/slang-13986.md`.
Main told the operator on the dashboard.

**11-05 19:02Z fixer [Report] (verified live 11-05):** still parked; no comment after 6639852932, #13991 draft @497b797,
#13984 still OPEN draft. Fixer re-armed its one-shot re-check to 11-07 19:00Z. Nothing new for the operator.

**11-07 19:01Z fixer [Report] (verified live 11-07):** no change. Nothing after 6639852932 on #13986; #13991 has no new
comments or reviews (draft @497b797); #13984 is still OPEN draft. The fixer posted nothing and re-armed to 11-09 19:00Z.
Nothing new for the operator (3 days with no maintainer reply).

**11-09 19:02Z fixer [Report] (verified live 11-09):** no change. The last #13986 comment is still 6639852932 (assignee
jhelferty-nv; the question has no @-mention, but the assignee is subscribed). #13991 is an OPEN draft @497b797 with 0 reviews,
and #13984 is still an OPEN draft. The fixer posted nothing and re-armed to 11-11 19:00Z. Nothing new for the operator (5 days
with no maintainer reply). It is a candidate for the weekly list if it is still silent at the 11-11 re-check.

**Resume on:** fixer report via its parent edge (triager) → the #13973 Main's chain; maintainer reply on #13986/#13991.
