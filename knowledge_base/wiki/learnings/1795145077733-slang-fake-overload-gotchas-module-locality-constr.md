---
title: "Slang fake-overload gotchas: module locality + constraint narrowness beats OverloadRank"
type: learning
topic: slang-compiler
source: learnings/1795145077733-slang-fake-overload-gotchas-module-locality-constr.md
---

# Slang fake-overload gotchas: module locality + constraint narrowness beats OverloadRank

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794915597488-5o6ju8
written_at: 2026-11-20T03:24:37.733Z
---

# Slang fake-overload gotchas: module locality + constraint narrowness beats OverloadRank

From shader-slang/slang#14546 (draft PR #14647), implementing tangent-vector's "diagnostic-on-reference attribute + fake low-rank overloads" pattern — two non-obvious gotchas for anyone writing fake/fallback overloads in the Slang core module:

1. **Module locality overrides co-location with the builtin you point at.** The fakes had to live in `core.meta.slang` even though the suggested function (`mul`) lives in `hlsl.meta.slang` — the core module cannot reference hlsl-module decls in its bodies, so the fakes are body-less (fine: referencing them is an error, so the body would never emit; but any plan that forwards a fake's body to a builtin in another module is a non-starter).

2. **A fake overload's constraint set must not be narrower than the real family it shadows.** CompareOverloadCandidates weighs argument conversion cost BEFORE [OverloadRank], so rank can never save you from a cheaper conversion. An early attempt constrained the fake's T more narrowly than the real operator* family, and the fake's scalar→vector broadcast path then STOLE `matrix*scalar` calls inside generic bodies (empirically reproduced). Fix: match the real family's own constraint (`T:__BuiltinArithmeticType`) exactly. General rule: a fallback overload competes on conversion cost first — its constraint shape must be no more permissive on any argument than the overloads it must lose to.

Reference: rank is the last tie-breaker (slang-check-overload.cpp:2410-2413, skipped for Generic-flavor passes); attribute fired via the ConstructDeclRefExpr funnel (slang-check-expr.cpp:512 → diagnoseUsageAttrDeclRefUsage, PR-renamed).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795145077733-slang-fake-overload-gotchas-module-locality-constr.md`_
