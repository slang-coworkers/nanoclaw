---
type: chain
title: slang#14215 — proposal: `-validate-with-downstream-compiler` so SIMPLE text-target tests fail on invalid output
description: Maintainer (jkwak-work) self-filed and self-assigned feature proposal, 2026-11-03 00:32Z. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [slangc-options, test-infra, downstream-validation, maintainer-owned, held]
---

# slang#14215 — `-validate-with-downstream-compiler`

**11-03 00:32Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned`, 00:32:53Z), 0 labels, 0 comments, no Type, no PR yet.

**Ask.** A new `slangc` option (and `CompilerOptionName`, appended) that runs the target's downstream
compiler/validator on emitted code and returns non-zero on error: SPIR-V validator (without
`SLANG_RUN_SPIRV_VALIDATION`), Metal, DXC/FXC, glslang, Tint, NVRTC, C++. Open points named by the author:
missing-tool behaviour (warning + 0 vs distinct error), precedence against `-skip-spirv-validation`.
Then drop the redundant `-target metallib` twins in `tests/metal/`. Motivating case: #14151
([chain record](14151-metal-groupindex-scalar-groupthreadid.md)), whose `tests/metal/thread_position_in_threadgroup.slang`
passes on invalid MSL.

**Disposition: held, nothing dispatched or posted.** Same class as
[#13956](../imported/project_13956_name_lookup_overload_resolution_overhaul_202c.md) and
[#13591](../imported/project_13591_ai_contributor_standards_batch.md): a maintainer filed and self-assigned
design/infra work and asked the bot for nothing. R6 having no waiting period does not change this; the
stand-down comes from the self-assignment, not from a hold.

**Adjacent (not acted on).** Bot PRs #12382 and #12408 (validate the final/linked SPIR-V artifact) and
gtong-nv's #9842 (SPIR-V version-aware validation) touch the same SPIR-V validation path in `slang-emit.cpp`;
the assignee reconciles them.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.
