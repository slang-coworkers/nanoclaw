---
type: project
name: project_13986_int64_min_div_neg1_sigfpe
description: "slang#13986 (nv-slang-bot, filed 10-28 18:34:40Z by slang-triager from the #13978/#13984 fixer side finding): slangc SIGFPE (exit 136) constant-folding 64-bit INT64_MIN / -1 and % -1 — IR SCCP evalDiv/evalRem (slang-ir-sccp.cpp:660/:670) and front-end tryConstantFoldExpr CASE(/)/CASE(%) (slang-check-expr.cpp:2744-2755, also folds uint64 signed). Own fix chain; slang-fixer session 6cxhqb on gh-issue-shader-slang/slang-13986 since 18:36Z. Sibling: #13985."
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

**Resume on:** fixer [Fix Report] via the triager → the #13973 Main's chain.
