---
type: chain
title: slang#13750 — conflict resolution between `using namespace` names and local/global variables
description: "skiminki-nv-filed (and assigned) design question. Triaged 10-19 (cmt 6272548845), reproduced cpu/vk/cuda. 10-21 the assignee gave a tentative C++-semantics direction (option A); bot recorded it in 6315330488. 10-26 superseded by #13956 (202c overhaul; rule 6 = wildcard imports lowest priority = option C). Bot plan withdrawn, comment edited in place. HELD on the assignee. 11-09 re-check t-ab041d: no trigger; #13956 rule 6 reopened (C or A, 10-29); 6315330488 corrected in place 19:08:58Z (verified). No further re-check."
tags: [slang, name-lookup, using-namespace, superseded, 202c]
resource: https://github.com/shader-slang/slang/issues/13750
---

# slang#13750 — `using namespace` conflict resolution

**Owner:** slang-triager (canonical thread `gh-issue-shader-slang/slang-13750`). No fixer, no PR.

## Timeline (verified on GitHub 2026-10-26)

- 10-19 16:56Z — triage comment 6272548845: reproduced on `68438b5e1` (cpu, vk, cuda); options A (C++ rule),
  B, C (`using namespace` names searched after the global namespace).
- 10-21 11:51Z — skiminki-nv (6315217870): after a talk with tangent-vector, "tentatively use the C++
  semantics" → bot comment 6315330488 recorded an Approach A plan with two open sub-decisions.
- 10-26 16:06Z — skiminki-nv opened [#13956](../imported/project_13956_name_lookup_overload_resolution_overhaul_202c.md)
  (202c overhaul, cites #13750). Characteristic 6: wildcard imports get the lowest priority (option C, not A).
  18:14Z closed sibling [#13888](13888-ambiguous-lookup-spurious-candidates.md) "will not fix" and bot draft PR #13889.
- 10-26 19:03Z — triager re-check: edited 6315330488 in place (no notification): on hold under #13956,
  Approach A withdrawn, no bot action pending. Verified the edit and all issue states.

## State

HELD on the assignee: keep #13750 open as a #13956 test case, or close it. Nothing for the bot unless an
@nv-slang-bot mention arrives (webhook). The 11-09 re-check is done and none is pending. A webhook is the only wake: a comment or the
#13956/spec#66 decision.

- 11-09 19:02Z — re-check `t-ab041d` (triager): no trigger fired (still OPEN, no new comments, no PR). Drift, which
  Main verified on GitHub: skiminki-nv edited #13956 at 10-29T13:49Z, and rule 6 now reads "either the lowest lookup
  priority or the C++ semantics (closest common parent namespace)". So the choice between C and A is open again. On 11-05
  #13956 was called "just my proposal sketch"; the real proposal goes through the 202c spec process
  (shader-slang/spec#66, 202c section incomplete). 19:03Z Main authorized ONE in-place edit of 6315330488 to
  correct its "rule 6 = lowest priority" claim. No new comment, and no re-check is scheduled. 19:08:58Z the triager edited
  6315330488 in place after codex OUTPUT_REVIEW (approved in round 3). The `::x` result is now conditional (C gives `::x`,
  A gives ambiguous). The `g(int)` point was dropped because #13956 no longer states it. Next-action now names the 202c
  proposal step. Main verified the `updated_at` on GitHub; still 4 comments, none new.

**Knock-on:** #13819 was "gated on #11449 + #13750 landing"; #13750 now lands through #13956.
