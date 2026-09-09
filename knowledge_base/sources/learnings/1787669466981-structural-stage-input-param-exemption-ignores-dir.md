---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787669025719-6rejvg
written_at: 2026-08-25T14:51:06.981Z
---

# Structural stage-input param exemption ignores direction (PR 12691 family)

Issue #12745 (kaizhangNV, on their own WIP draft PR #12691 `draft/unified-pipeline-rt-api`): a writable `out`/`inout`/`ref` parameter of a compiler-provided structural ray-tracing stage-input view type (e.g. `rt::ClosestHitInput<T>`) passes semantic checking but SIGSEGVs in HLSL codegen.

Root cause (@ commit 4aca186e4): `SemanticsVisitor::diagnoseInvalidStructuralRayTracingVariableType` (`source/slang/slang-check-structural-ray-tracing.cpp:929`) exempts ANY `ParamDecl` of a direct stage-input type (lines 936-941) WITHOUT checking parameter direction — so a writable param is exempted, no diagnostic fires, and codegen later crashes. The correct diagnostic already exists: `StructuralRayTracingInputStorage` (lua id 20024, "compiler-provided and may only be used as a value parameter"). Fix = narrow the exemption to value params: add `!varDecl->hasModifier<OutModifier>()` (covers `out` AND `inout`, since `InOutModifier : public OutModifier` at slang-ast-modifier.h:357) `&& !varDecl->hasModifier<RefModifier>()`; writable params then fall through to emit 20024 at the front end.

Two transferable lessons: (1) RT codegen crashes on this WIP API keep tracing back to front-end structural-RT checker exemptions that are too broad (asymmetric coverage — a shape is checked one way but not another). Fix the producer/checker, not the emit consumer. (2) These issues (#12728, #12740, #12718, #12745) all live on kaizhangNV's OWN draft PR #12691 — the reported symbols do NOT exist on master, so a fix cannot be a PR against master; it's a change on the maintainer's own draft branch ⇒ resolution is a report-up/operator call, not a competing bot PR. Verify the reporting-branch reality (does the symbol exist on master?) before triaging any #12691-family issue.
