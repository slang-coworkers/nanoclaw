---
type: chain
title: slang#14301 — `[vk::constant_id]` / `[SpecializationConstant]` on a `groupshared` variable is silently dropped (no diagnostic)
description: Bot-filed 11-04 06:3xZ, side find of the #14290 / PR #14300 chain (R1 review). Not a regression. Do NOT dispatch its issue_opened webhook. Held filed-only (P3).
tags: [diagnostics, specialization-constant, groupshared, side-finding]
---

# slang#14301: spec-constant attribute on `groupshared` dropped silently

⚠️ **Its `issue_opened` webhook belongs to the [#14290 chain](14290-e31226-spec-constant-array-static-const-false-positive.md),
so do not dispatch it.** If a Main session is minted for it, that session must send nothing.

slang-triager (task session `sess-1793667544858-o8dnsv`) filed it 11-04: Bug + `reproduced`, not a regression (v2026.5.2
also emits no SpecId), no duplicate. Related: #14030 (spec-constant-sized groupshared arrays) and #12558 (modifier
allow-list proposal). `[vk::constant_id(0)] groupshared int N;` compiles with rc=0 on spirv, glsl and hlsl, and the
attribute is dropped silently. The same attribute on `static` gets E31219: the only storage check,
`PushOrSpecializationConstantCannotBeStatic` (slang-check-decl.cpp ~:21517), rejects `static` but not `groupshared`.
It does not affect #14300 (R1 commit c685ff1 limits the exemption to `isGlobalShaderParameter && isSpecializationConstant`).
Triager suggests P3: a missing diagnostic on an invalid declaration.

**11-04 06:3xZ, Main:** held filed-only (P3). Revisit when the #14290 chain closes.

**11-04, Main (webhook session):** `issue_opened` webhook received and not dispatched, per the hold above. No row sent.
