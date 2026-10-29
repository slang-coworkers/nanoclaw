---
type: project
name: project_13985_uint64_loop_trip_count_signed
description: "slang#13985 (nv-slang-bot, filed 10-28 18:33Z by slang-triager from the #13978/#13984 fixer side finding): for-loop trip-count inference in slang-check-stmt.cpp compares uint64 bounds as signed, so a bound above INT64_MAX gives a false E30514 'loop runs zero times' and the loop is deleted. Own fix chain; slang-fixer session 80nd8r on gh-issue-shader-slang/slang-13985 since 18:35Z. Sibling: [#13986](project_13986_int64_min_div_neg1_sigfpe.md) (SIGFPE on INT64_MIN / -1)."
---

# slang#13985: uint64 `for` loop with a bound above INT64_MAX is removed as zero-trip

**Origin.** slang-fixer (session `3s6rec`, #13978 chain, draft PR #13984) reported two side findings
at 18:29Z. The #13973 Main (`sess-1793201570113-2tdabv`) gave the triager (`79rk2o`) a go-ahead at
18:31:17Z: file both, then hand each to slang-fixer as its own chain, keep the PRs independent on
master, and note the overlap with #13975/#13984 in `slang-check-expr.cpp`. The second finding became
#13986.

**Ownership.** The issue_opened webhook landed 18:33Z in Main `sess-1793212431815-3vzkl5`. That Main
ran the bot-filed-owner ladder and found the owner at rung 7 (the triager's and #13973 Main's newest
rows). It dispatched nothing. The triager sent `[Triage handoff]` at 18:35:51Z, and **slang-fixer
session `sess-1793212552468-80nd8r`** is on the canonical thread (checked 18:36:28Z).

**Resume on:** fixer [Fix Report] via the triager → the #13973 Main's chain.
