---
type: chain
title: slang#14279 — SPIR-V `static const` array of spec constants emits `OpConstantComposite` with spec-constant operands
description: Bot-filed side finding of the #14238 / PR #14267 chain (11-03 23:26Z). Do NOT dispatch its issue_opened webhook. Held filed-only (fixers loaded); operator told.
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
