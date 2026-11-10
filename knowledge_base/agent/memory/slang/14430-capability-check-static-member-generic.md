---
type: chain
title: slang#14430 — capability check misses `[require]` of a static member called through a generic type
description: Maintainer (jkwak-work) self-filed and self-assigned capability-check bug, 2026-11-10 01:56Z, with own root cause + fix attempt. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [capabilities, semantic-check, require, generics, static-member, maintainer-owned, held]
---

# slang#14430 — `S<float>.SF()` skips the `[require]` check

**11-10 01:56Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (events `assigned`, 01:56:21Z), 0 labels, 0 comments. Timeline `referenced` at
01:56:38Z by commit `109cfeb993` (jkwak-work, "tests: name issue #14430 in the TODO of the disabled CoopMat
GetLength test", touches only `tests/cooperative-matrix/metal-unsupported.slang`; no PR attached yet).

**Ask.** A static member of a generic struct (`S<float>.SF()`, `[require(spirv)]`) compiles for `-target hlsl`
with exit 0; non-generic static, generic free fn, plain free fn and instance method all error E36107. Core-module
case: `linalg.CoopMat<...>.GetLength()` on Metal (the `-DTEST_GETLENGTH` line of
`metal-unsupported.slang` passed only because of [#14266](14266-diag-tests-exit-code.md)). Author's root
cause: `SemanticsDeclReferenceVisitor` (`slang-check-decl.cpp`) — member decl-ref is not direct, `visitVal`
walks only Val operands, and `visitStaticMemberExpr` lacks the `processDeclModifiers` call that
`visitDeclRefExpr` has. Author's fix attempt breaks the core module (`coopVecLoad*` missing `optix_coopvec`;
E36120 at `hlsl.meta.slang:25409` `case hlsl_nvapi`), so a full fix also needs `*.meta.slang` `[require]`
corrections.

**Disposition: held, nothing dispatched or posted.** Same class as #14266/#14292: maintainer filed with
own root cause and fix direction, self-assigned, and asked the bot for nothing (rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)).

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.
