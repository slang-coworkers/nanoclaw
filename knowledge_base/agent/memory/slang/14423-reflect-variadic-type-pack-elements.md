---
type: project
title: "slang#14423 — reflection of concrete variadic generic type-pack elements"
description: "HELD (rung 4) 11-09: maintainer-filed feature request (kaizhangNV, MEMBER), assigned to the author by jhelferty-nv 42 s after filing. Follow-up to their own portable-RT backend work. No dispatch, no bot post."
---

**2026-11-09 18:18Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, no
milestone. Assignee kaizhangNV (the author), assigned 18:19:14Z by jhelferty-nv (`.assigner`).
Timeline has only that `assigned` event. No other kaizhangNV filings since 11-08, so not a batch.
`grep -rl 14423 memory/` had no hits; the only session on `gh-issue-shader-slang/slang-14423` is
this Main webhook session (`a7ipao`); no task.

**What it asks.** A general reflection API to enumerate the concrete types bound to a variadic
type pack, in order: for `typealias Types = TypeList<A, B>` (`struct TypeList<each T>`), return
`TypeReflection(A)`, `TypeReflection(B)`. `GenericReflection::getTypeParameterCount/getTypeParameter`
(`slang-reflection-api.cpp`) enumerate `GenericTypeParamDecl` only and skip
`GenericTypePackParamDecl`. Requirements: keep pack order; return ordinary types usable with
existing queries; handle aliases, empty packs, nested specialization and serialized-IR modules;
tell an unresolved pack from a concrete empty pack; no codegen needed. Use case: automatic stage
discovery for `rt::HitGroupList<...>` / `MissShaderList` / `CallableShaderList` in a portable RT
schema. API shape left open. Related: #4786 (generic-container reflection).

**Why held.** Rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
a maintainer item assigned to its author by a peer maintainer, sequenced on the author's own RT
backend PR (on their fork). Same shape as #14420 and #14364.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
