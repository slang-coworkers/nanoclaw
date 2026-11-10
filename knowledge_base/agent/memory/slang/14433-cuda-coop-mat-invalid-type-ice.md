---
type: chain
title: slang#14433 — CUDA coop matrix: invalid element type / shape ends in an ICE (exit -2)
description: Maintainer (jkwak-work) self-filed + self-assigned 11-10 02:44Z. Follow-up of the #14266 diag= exit-code work. HELD rung 4: no dispatch, no post.
tags: [cuda, cooperative-matrix, emit, diagnostics, exit-code, maintainer-owned, held]
---

# slang#14433 — CUDA coop matrix invalid type → internal compiler error

**11-10 02:44Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work** (MEMBER), assigned to
jkwak-work by jkwak-work at 02:44:34Z (1 s after filing), 0 labels, 0 comments, no linked PR or commit.

**Ask.** `CUDASourceEmitter::emitWMMAFragmentType` (`source/slang/slang-emit-cuda.cpp`) diagnoses E50000
(element type, ~line 1789) / E50001 (shape, ~line 1804) and then hits `SLANG_RELEASE_ASSERT(false)` before
`return SLANG_FAIL`, so slangc exits -2 instead of -1. Tests: `CHECK_TYPE` / `CHECK_SHAPE` in
`tests/cooperative-matrix/cuda-coop-mat-diagnostics.slang`, which fail with the
[#14266](14266-diag-tests-exit-code.md) exit-code check on a CUDA machine. Suggested fix: drop the asserts,
or add the IR validation pass that the TODO describes.

**Disposition: held, nothing dispatched or posted.** Same class as #14266 / [#14431](14431-separate-debug-info-non-spirv-error.md):
maintainer filed and self-assigned the work and asked the bot for nothing (rung 4). **Resume** only on an
@nv-slang-bot mention or an operator ask. Mentions arrive as webhooks, so no timer.
