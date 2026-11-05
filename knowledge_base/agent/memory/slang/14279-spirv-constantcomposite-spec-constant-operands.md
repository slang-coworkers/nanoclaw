---
type: chain
title: slang#14279 — SPIR-V `static const` array of spec constants emits `OpConstantComposite` with spec-constant operands
description: Bot-filed side finding of the #14238 / PR #14267 chain (11-03 23:26Z). Do NOT dispatch its issue_opened webhook. Fixer chain started 11-04 03:2xZ (slot freed); operator told.
tags: [spirv, specialization-constant, static-const, invalid-output, side-finding]
---

# slang#14279: `OpConstantComposite` with spec-constant operands (invalid SPIR-V)

⚠️ **Its `issue_opened` webhook belongs to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md),
so do not dispatch it.** The Main session minted for it (`sess-1793748405521-ss7btz`) must send nothing.

Found by the #14267 peer reviewer (pre-existing). slang-triager reproduced and filed it 23:26Z: type Bug,
`reproduced`, no @-mentions; same on master `f1cd35ff8` and v2026.13.1, so not a regression. The output is invalid SPIR-V
and is written silently unless validation is on (it should be `OpSpecConstantComposite`). Triager suggests P2.

**11-03 23:3xZ: held filed-only by Main** (9 fixer sessions running; #14278 went first). Next in line when a fixer
slot frees, or earlier if the operator says so. Listed in the operator report.

**11-04 03:2xZ: fixer chain STARTED by Main** (4 fixer sessions running). Route: triager `[Triage handoff]` → slang-fixer on
`gh-issue-shader-slang/slang-14279`, draft PR on master. Interplay to check: #14285 moves the SpecConst legal-global rule into
the shared `isLegalGlobalInst` and removes SPIR-V's copy; and #14290 (front-end E31226) hides the `{N, 3}` shape until it is fixed.
Ready-flip: see the 03:33Z entry (now a regression, so the direct path).

**11-04 03:33Z, triage (triager row 70; memo `/workspace/inbox/a2a-1793763228911-c7wdnw/triage-14279.md`):** **regression after all**: v2026.5.2 passes validation and v2026.7 fails. The triager
added `regression` to its own filing. Medium-high / SPIR-V emit / P2. Cause: `emitCompositeConstruct`
(slang-emit-spirv.cpp:9904-9921) always emits `OpConstantComposite` for a module-scope Make* op. Since v2026.7 these stay
global (the SPIR-V inliner keeps SpecConst ops global, slang-ir-spirv-legalize.cpp:2064). It is wider than filed: a
function-local `int2(64/N, 3)` is hoisted too, and so are nested arrays and matrices. Plan A: emit
`OpSpecConstantComposite` when any constituent is a spec constant (one site, all 7 Make* ops; `emitOpSpecConstantComposite`
exists at slang-emit-spirv-ops.h:599). B (SpecConst rate on Make*) was rejected because it conflicts with #14285. Handed to
slang-fixer on `gh-issue-shader-slang/slang-14279`; A does not depend on #14285 (from a subagent code read).
**Ready-flip: direct path** (triager → me → one operator ask), because it is a regression. I left the triager's default in
place and sent no reply. Side note: `-emit-spirv-via-glsl` for the array shape is rejected by glslang, and was already on
v2026.5.2, so it is an older separate bug; the triager may file it filed-only.
**11-04 04:28Z: draft PR #14293 OPEN** (I verified it: draft, head `90c1652cf`, `pr: non-breaking`, `Fixes #14279`. The
pr-mapping points to fixer `sess-1793763240906-gbxgyb`.) The fixer posted its own status comment 6622532053 on #14279.
Peer review is next. Ready-flip: triager → me → one operator ask (regression).

**11-04 04:30Z:** overlap with parked bot draft #13826 (#13767 chain): a stale comment only. #14293's description notes it, and whichever PR lands second fixes the comment. I did not wake #13826.
**11-04 05:23Z: ready-flip question** (triager row 464; fixer [Fix Report] msg 104). #14293 head `16cb5b9c9`, 2 files
+242/−3. R1 APPROVE_WITH_NITS (0 bugs), nits applied. New test `tests/spirv/spec-constant-composite.slang` (Vulkan, 30
values). tests/spirv 746/746 and full suite 11449/11452 (fixer-reported). Status comment 6622532053 says "review complete,
ready-flip pending". **05:2xZ: ONE direct operator ask** ("flip 14293" / "hold 14293"). No re-ask; unanswered → weekly list.
The triager was told: no `gh pr ready` until I relay an answer.
⚠️ **Downstream dependency (11-04 08:1xZ): #14300 (the #14290 fix) is held as a draft until #14293 merges.** When #14293
merges, wake the #14300 fixer (`sess-1793766458765-6l1e8e`, thread `gh-issue-shader-slang/slang-14290`) to merge master,
apply the saved SPIR-V/Vulkan lane patch, and send the ready-flip question again.
