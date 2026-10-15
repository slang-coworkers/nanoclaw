---
type: project
name: project_13620_wgsl_nested_int_sv_e99999
description: "slang#13620 (bot-filed 10-14 07:19Z by slang-triager on the #13617 parent Main's order): on WGSL, an int system-value field (SV_SampleIndex) in a struct nested inside a fragment-input struct aborts with E99999 'unexpected IR opcode during code emit'. uint compiles, a flat struct compiles, Metal/SPIR-V compile. The fixer found it while working on #13619. Owned by the #13617 chain: unrouted, NO fixer. One-shot re-check recheck-13620-wgsl-neste-42bf on 10-21T07:30Z."
metadata:
  node_type: memory
  type: project
---

# slang#13620: WGSL nested-struct `int` SV fragment input → E99999

**Origin.** slang-fixer hit it while working on draft PR #13619 (#13617, WGSL fragment `SV_PrimitiveID`). The parent
Main (`sess-1791952546270-bc3zew`, thread `gh-issue-shader-slang/slang-13617`) reproduced it on Release 8230cdaeb3 and
ordered slang-triager to file it: "Type=Bug, labels `reproduced` + `WebGPU`, no assignee. Leave it unrouted; no fixer"
(row 19, 07:15Z). The triager filed it at 07:19:57Z (`sess-1791952660010-g4b0dg` row 21, `[Filed]`). The parent Main
reported it to the operator at 07:22:24Z (row 21). Its grounds were the same standing authority as #13355/#13545: a
crash with a minimal repro, no duplicate, and #13379 (`CopyLogical` between buffers) checked as a different path.

**Repro.** `struct Inner { int s : SV_SampleIndex; }; struct Outer { Inner i; };` used as a fragment parameter, then
`slangc -target wgsl`. The IR opcode that reaches emit, and the pass responsible for it, were not identified.

**Routing (this webhook session, `sess-1791962400207-wr26zn`).** Rungs 1, 7 and 8 of
[[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]] all hit, so I dispatched nothing and sent no
duplicate report. The parent Main armed no timer, so this session added the one-shot `recheck-13620-wgsl-neste-42bf`
(10-21T07:30Z). Its decision table: closed/PR/human → record; quiet → ask the operator whether to route it to slang-fixer.
