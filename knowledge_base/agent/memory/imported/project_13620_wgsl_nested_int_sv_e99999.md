---
type: project
name: project_13620_wgsl_nested_int_sv_e99999
description: "slang#13620 (bot-filed 10-14 07:19Z by slang-triager on the #13617 parent Main's order): on WGSL, an int system-value field (SV_SampleIndex) in a struct nested inside a fragment-input struct aborts with E99999 'unexpected IR opcode during code emit'. uint compiles, a flat struct compiles, Metal/SPIR-V compile. The fixer found it while working on #13619. Owned by the #13617 chain: unrouted, NO fixer. jkwak-work self-assigned it 10-14 17:42Z (milestone Q4 2026 Fall), so the re-check was cancelled 10-15. Root cause traced 10-15: legalizeSystemValue converts a struct-field KEY as if it were a value."
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

## 2026-10-15: maintainer-owned, root cause traced (operator asked for a triage)

**Owner.** jkwak-work self-assigned it at 10-14 17:42Z and set milestone Q4 2026 (Fall). There are no comments. I
cancelled `recheck-13620-wgsl-neste-42bf` because its "assigned → record, done" row had already been met. No fixer.

**Root cause (from the `-dump-ir` of the issue repro; local Release build is from 08-04, source at `6597ec9202`).** The
WGSL `collectSystemValFromEntryPoint` (`slang-ir-legalize-varying-params.cpp:5355`) makes a work item from each *field
key* of the flattened struct param. When the declared type isn't permitted (`int` vs `u32` for `sample_index`),
`legalizeSystemValue`'s conversion branch (:3041–3058) does `var->setFullType(UInt)` on the **key**, then emits
`intCast(key)` and `replaceOperand`s every use, including the `IRStructField`'s key operand. The final IR has
`struct %Inner { field(%s, Int) }` where `%s = intCast(%s1)`, and the emitter hits the cast as a struct key, so E99999.
`uint` takes no conversion and compiles. A flat struct compiles because its param is split into a scalar `UInt` param,
where the same conversion is valid.

**Breadth (same build).** Any SV that needs a type conversion inside a 2-level nested struct crashes: vertex
`int SV_VertexID` and fragment `float2 SV_Position` both E99999. A sibling SV/user field doesn't change that. At
**3 levels** (`Outer{Mid{Inner{sv}}}`) it doesn't crash: `fn main(m_0 : Mid_0)` is emitted with the SV demoted to
`@location(0)`, a nested struct member without an IO attribute, and duplicate `@location(0)`. That's invalid WGSL from
an incomplete flatten. It's unverified on current master and not in the issue.
