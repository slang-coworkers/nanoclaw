---
type: project
name: project_13965_language_version_per_dialect
description: "slang#13965 (tangent-vector, 10-27 22:14Z, assigned to author by jhelferty-nv 13 s later): maintainer design proposal for per-dialect language versions (HLSLLanguageVersion/GLSLLanguageVersion, SourceLanguageAndVersion, -lang hlsl2018/glsl440, #language in HLSL, consistency diagnostics). Asks nothing of the bot -> held: NO dispatch, NO bot post."
---

# slang#13965 — every supported dialect should have a "language version"

**10-27 22:14Z, `issue_opened`.** Live read 10-27: OPEN, author **tangent-vector**, assigned to
tangent-vector by **jhelferty-nv** at 22:15:05Z, no labels, 0 comments, live body = payload body.
Body is a design spec: add `HLSLLanguageVersion` / `GLSLLanguageVersion` enums alongside the Slang
one; track a `SourceLanguageAndVersion` pair through the front end only (never past IR linking);
allow combined `-lang hlsl2018` / `slang2025` / `glsl440`; allow `#language` for HLSL input; a
table of consistency rules (CLI vs directive = error, CLI vs file extension = warning, extension vs
directive = error, `#version` outside GLSL = error, secondary-file `#language` must match the
primary). Motivated by #13964.

**Disposition: held, nothing dispatched or posted.** Maintainer-owned design proposal, assigned to
its author by a peer maintainer — the class in
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)
rung 4. Same shape as [project_13956](project_13956_name_lookup_overload_resolution_overhaul_202c.md).

**Related live chain (not acted on from here):** #13964 (HLSL member functions no longer callable
on immutable receivers; `regression`, `reproduced`, assigned tangent-vector) is owned by sibling
Main session `sess-1793136887746-81yz2f` with triager and fixer sessions on
`gh-issue-shader-slang/slang-13964`. A fix there may want an HLSL version gate that this issue
defines; that coordination belongs to the assignee.

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so no re-chase timer.
