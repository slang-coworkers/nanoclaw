---
type: chain
title: slang#14440 — -pass-through glslang -target spirv stops with E99997 "no matching IR symbol" unless -emit-spirv-via-glsl
description: Bot-filed 2026-11-10 13:21Z by the #14432 triager while reproducing #14439. Owned by the #14432 chain, FILED-ONLY, no fixer chain. Its issue_opened webhook needs NO dispatch.
tags: [slangc, pass-through, glslang, spirv, internal-error, bot-filed, filed-only]
---

# slang#14440 — `-pass-through glslang -target spirv` gives an internal error

**Filed 11-10 13:21Z** by nv-slang-bot (verified: open, `reproduced`, Type=Bug, no assignee). Even on valid GLSL,
`-pass-through glslang -target spirv` stops with internal error E99997 "no matching IR symbol" (exit -2) unless
`-emit-spirv-via-glsl` is given. The triager's hypothesis: `slang-code-gen.cpp:1169-1175` takes direct SPIR-V emission
without checking `isPassThroughEnabled()`. A search for "no matching IR symbol" found no open duplicate.

**Owner:** the [#14432 chain](14432-slangc-E-exit-code-on-preprocessor-error.md), found while reproducing
[#14439](14439-slangc-E-pass-through-exit-code.md). Filed-only. A fixer chain starts only on a maintainer or operator ask.

**11-10 — `issue_opened` webhook received; not dispatched** (as planned). Live check at receipt: open, `reproduced`,
no assignee, no comments.
