---
type: chain
title: slang#14248 — GLSL `inverse(matrix)` exists only for GLSL/SPIR-V; HLSL and other targets fail with E36107
description: Maintainer (jkwak-work) self-filed and self-assigned enhancement with its own implementation proposal, 2026-11-03 18:44Z. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [glsl-module, matrix, inverse, hlsl, capability-gate, maintainer-owned, held]
---

# slang#14248 — GLSL `inverse` on non-GLSL targets

**11-03 18:44:19Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned` 18:44:20Z), 0 labels, 0 comments, no PR.

**Ask.** `inverse(matrix<T,N,N>)` in `source/slang/glsl.meta.slang` is `[require(glsl, GLSL_400)] [require(spirv)]`
only, so `-lang glsl` source that calls it fails with E36107 on hlsl/cuda/cpp/metal/wgsl. The proposal: a Slang-source
default `__target_switch` arm (2x2/3x3/4x4 via determinant + adjugate), then widen the `[require]` list; HLSL first,
then CUDA/CPP/Metal/WGSL/LLVM. Then remove the `TARGET_HLSL` guard in `tests/glsl-intrinsic/intrinsic-basic-scalar.slang`.

**I checked on origin/master 7f4efc7ce:** the gate is at `glsl.meta.slang:891-894`, as described. The test on master
has no `TARGET_HLSL` macro and no HLSL line yet. jkwak-work has no open PR that adds one, so the HLSL line is
most likely their own in-progress local work (same pattern as #14247, found while fixing `gh-4700.slang`).

**Duplicates/related:** none open. Title search "inverse" finds only autodiff "inverse-direction" items (#11551, #11558).
The [#14020 RFC](14020-dense-linalg-module-rfc.md) triager noted the same fact (`inverse` only GLSL/SPIR-V, no
derivative). [#13355](13350-glsl-matrix-mul-wgsl-metal-gate.md) (62 builtins gated without metal/wgsl, held on
jkwak-work) does not list `inverse`; that gate also excludes hlsl, so it is a different set.

**Disposition: held, nothing dispatched or posted.** Same class as
[#14215](14215-validate-with-downstream-compiler.md) (same author, same day): a maintainer filed and self-assigned
work with their own proposal and asked the bot for nothing. The stand-down comes from the self-assignment, not
from an R6 hold.

**Precedent conflict (flagged to the operator 11-03):** #14247 (jkwak-work, 18:35Z) was also self-assigned 1 s
after filing, but it went to slang-triager. Its record does not mention the assignment. jkwak-work now
self-assigns at filing, so self-assignment alone does not tell "I am fixing this" from "I track this".

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so there is no re-check timer.
