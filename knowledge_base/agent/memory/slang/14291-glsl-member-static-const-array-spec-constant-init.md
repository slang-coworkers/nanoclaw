---
type: chain
title: slang#14291 — GLSL: struct-member `static const` array of spec-constant expressions emitted as a non-constant global `const` initializer
description: Bot-filed 11-04 03:35Z, side find of the #14279 chain. Not a regression (v2026.5.2 is the same). Do NOT dispatch its issue_opened webhook. Held filed-only (P3).
tags: [glsl, specialization-constant, static-const, side-finding]
---

# slang#14291: GLSL rejects a member `static const` array initialized with spec-constant expressions

⚠️ **Its `issue_opened` webhook belongs to the [#14279 chain](14279-spirv-constantcomposite-spec-constant-operands.md),
so do not dispatch it.** If a Main session is minted for it, that session must send nothing.

slang-triager (task session `sess-1793667544858-o8dnsv`) filed it 11-04 03:35Z: Bug + `reproduced`, no `regression`
(v2026.5.2 is the same), no @-mentions, deduped. With `-target glsl`, a struct-member
`static const int arr[2] = {64/N, 32/N}` with a spec-constant N becomes the global
`const int arr_0[2]`, initialized by the constructor `int[]( … )` with the arguments `64/N_0` and `32/N_0`; glslang rejects it ("global const initializers must be constant"). The
vector form compiles. Triager suggests P3, after #14290.

**11-04 03:3xZ, Main:** held filed-only (P3, older bug, fails loudly). Revisit when the #14279/#14290 chains close.
