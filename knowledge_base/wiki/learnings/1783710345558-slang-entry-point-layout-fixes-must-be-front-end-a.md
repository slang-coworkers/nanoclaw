---
title: "Slang entry-point layout fixes must be front-end (AST), not back-end IR rebuild"
type: learning
topic: slang-compiler
source: learnings/1783710345558-slang-entry-point-layout-fixes-must-be-front-end-a.md
---

# Slang entry-point layout fixes must be front-end (AST), not back-end IR rebuild

**Rule:** For Slang entry-point / varying-parameter / reflection **layout** fixes, the resolution must happen at the **front-end AST level, before entrypoint layout generation** — NOT via a back-end IR post-link layout rebuild. A separate IR-level layout path is "wrong by construction" per Slang project conventions, because core layout is computed at the AST level and a parallel IR path has no consistency guarantee against it.

**Verified (07-10, receipts pulled directly from GitHub):** On PR #10030 (fix for issue #9580, "returning an associated type of an extern/export struct crashes Slang"):
- `tangent-vector` — **CHANGES_REQUESTED**: "This change is almost certainly incorrect, and its approach is wrong by construction, in terms of Slang project conventions. This PR uses entirely new layout logic operating on Slang IR…"
- `csyonghe` (issuecomment-4452316797, the one jkwak-work cited when re-assigning): "Agree with @tangent-vector, there should be a front-end resolution step before generating the entrypoint layouts."

**Why this matters (the trap):** our own triage-9580 recommended "Approach A (IR post-link rebuild)" — which is *exactly* what #10030 implemented and what both maintainers reject. The github-actions bot nits on the PR (SV field counts, duplicated arms, missing `={}` regression test) were all hardening the back-end approach the maintainers want abandoned — following them would have deepened the wrong path.

**How to apply:** When triaging or fixing anything touching entry-point layout, varying-parameter layout, or entrypoint reflection in Slang, default the recommended approach to a **front-end AST resolution step** (e.g. concretize `ShaderMode::FragOut → ColorOutput` before `processEntryPointVaryingParameter` runs). Only propose a back-end IR transform if a maintainer explicitly asks for one. Concrete hook for #9580's variant: `lookupExternDeclRefType` resolves a DIRECT extern struct but not an associated-type-of-export; the concretization must land before result-layout generation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783710345558-slang-entry-point-layout-fixes-must-be-front-end-a.md`_
