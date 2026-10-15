---
type: project
name: project_13622_global_in_sv_stage_check_gap
description: "slang#13622 (bot-filed 10-14 10:25Z by slang-triager on the #13617 parent Main's order): a fragment-only system value (SV_SampleIndex, SV_IsFrontFace) declared as a global `in` in a vertex entry point skips the E30702 stage check; WGSL/Metal compile rc 0 and emit the fragment-only builtin, SPIR-V is caught only by spirv-val (VUID-04354 → E99999). The parameter form gives E30702. 10-14 17:42Z jhelferty-nv assigned it to tangent-vector (milestone Q1 2027); 20:43Z tangent-vector posted design notes. MAINTAINER-OWNED: bot does nothing; re-check cancelled."
metadata:
  node_type: memory
  type: project
---

# slang#13622: global `in` SV semantics skip the entry-point stage check

**Origin.** Found during the internal review of draft PR #13619 (#13617, WGSL fragment `SV_PrimitiveID`). The parent
Main (`sess-1791952546270-bc3zew`, thread `gh-issue-shader-slang/slang-13617`) reproduced it on Release 8230cdaeb3 and
ordered slang-triager to file it as "Type=Bug, `reproduced` + `WebGPU`, no assignee, unrouted, no fixer" (row 27, 10:19Z).
The parent had already told the operator at 10:20Z (row 33) that the filing was authorized. The triager filed it at 10:25:15Z
and reported `[Filed]` at 10:26Z (`sess-1791952660010-g4b0dg` row 25). The parent's re-chase `rechase-13617-primitive-3220`
(10-15T10:30Z) lists #13622 as a side issue and leaves it alone unless a human comments.

**Repro.** `in uint s : SV_SampleIndex;` read in a `[shader("vertex")]` entry point. Measured at master 584103334:
WGSL and Metal give rc 0, SPIR-V gives E99999 via the validator only. The pointer is `validateSystemValueSemantic`
(`slang-check-shader.cpp` ~2020–2073), which iterates entry-point params and result, not globals. That pointer is the
reviewer's, not a confirmed diagnosis. #13209 and #6319 were checked and are not the same.

**Routing (this webhook session, `sess-1791973517705-b606f8`).** Rungs 1, 7 and 8 of
[[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]] all hit, so I dispatched nothing. The parent
Main was silent for about 5 minutes after the filing report and armed no timer for this issue (same shape as #13620,
[[project_13620_wgsl_nested_int_sv_e99999]]), so this session added the one-shot `recheck-13622-global-in-fbbb`
(10-21T10:30Z). Its decision table: closed/PR/human → record; quiet → ask the operator whether to route it to slang-fixer.

**10-14, maintainer took it.** At 17:42Z jhelferty-nv assigned it to tangent-vector and set milestone Q1 2027, and jkwak-work
added `Metal`. At 20:43Z tangent-vector posted design notes "so that I can make sure the fix takes them into account"
([comment 6178020266](https://github.com/shader-slang/slang/issues/13622#issuecomment-6178020266)). It @-mentions nobody
and asks the bot nothing. The notes:
(1) the fix is front-end: check global-scope varyings and entry-point params as one combined list, under the same rules;
(2) allow either global varyings or entry-point params for an entry point, not both, and make mixing them an error;
(3) warn on global varyings that carry `SV_` semantics;
(4) diagnose global varyings outside the GLSL dialect, because they "were never intended to be a feature of the Slang language".
**Routing (webhook session `b606f8`):** held, with no dispatch and no bot post, because an assigned maintainer is working
on it ([[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]], the human-mention holds).
I cancelled `recheck-13622-global-in-fbbb`, since its "ask the operator whether to route it to slang-fixer" branch is moot.
**Cross-chain note:** #13619's WGSL-legalizer stage check for global `in` (`checkSystemValueUse`, added in R1) is a
backend backstop for exactly the front-end gap that tangent-vector wants closed at the front end. I recorded it in
`rechase-13617-primitive-3220` as "do not act unless a maintainer raises it on #13619" and flagged it to the operator.
