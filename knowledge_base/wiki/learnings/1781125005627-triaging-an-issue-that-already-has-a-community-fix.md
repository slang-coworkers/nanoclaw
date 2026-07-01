---
title: "Triaging an issue that already has a community fix PR — review, don't duplicate"
type: learning
topic: review-process
source: learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md
---

# Triaging an issue that already has a community fix PR — review, don't duplicate

When a GitHub issue is a *tracking issue* for an already-open community fix PR (common pattern: a Slang dev files the issue referencing a contributor's PR), two things are easy to get wrong:

1. **Still post the triage 5-bullet on the issue.** If the PR predates the issue, its body has no `Fixes #N` link, so the PR does NOT carry the issue's observability trail. The fixed-via-PR exception does not apply — the issue would otherwise have zero public footprint. Post the verdict on the issue (verdict = "triaged → PR #X already fixes this, pending review").

2. **Tell the fixer to VERIFY/REVIEW the existing PR, not write a competing one.** The triage→fixer handoff still happens (no "if actionable" gate), but make it loud: a complete, tested PR exists; duplicating it wastes work and steps on a contributor. Frame it as review-and-land. Merge stays operator-gated.

Example: shader-slang/slang#11543 (HLSL mesh output qualifiers) tracked PR #11512 (created 2 days earlier by a contributor). Posted 5-bullet on the issue, handed to slang-fixer to review #11512.

**Mesh-emit technical note (HEAD ~2026-06):** The HLSL `out vertices`/`out indices`/`out primitives` qualifier has TWO independent emit sources, which is why bugs come in a missing/duplicate pair:
- `HLSLSourceEmitter::emitMeshShaderModifiersImpl` (slang-emit-hlsl.cpp) bakes `out` into the string and is keyed off `IRMeshOutputDecoration`, but its call site `CLikeSourceEmitter::emitSimpleFuncParamImpl` (slang-emit-c-like.cpp) gates it behind a `VaryingInput||VaryingOutput` var-layout check. An output struct driven ONLY by system-value semantics (e.g. just `SV_Position`) does NOT register `VaryingOutput` → qualifier silently dropped (the MISSING symptom).
- `emitParamTypeImpl` independently emits a bare `out` for any `IROutParamType`. HLSL-style `out vertices T[]` params carry `IROutParamType` (param-direction marker); generic `OutputVertices<T,N>` params do NOT. So HLSL-style gets `out indices ` + `out ` = `out indices out` (the DUPLICATE symptom), while generic gets nothing.
- Root representational asymmetry: the two syntaxes converge only on `IRMeshOutputDecoration`; one carries `IROutParamType`, the other doesn't. Emit-time fixes (ungate + suppress redundant out) work; the principled fix is sourcing the `out` from one place for both.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781125005627-triaging-an-issue-that-already-has-a-community-fix.md`_
