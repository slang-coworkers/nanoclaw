---
type: chain-record
title: "slang#14734 — program layout rebuilds the extern type map for every extern type lookup (K×N perf)"
description: Bug chain 11-26; fixed same day, draft PR #14735 @ f9fd63c parked on human review + ready-flip (weekly list).
---

# slang#14734 — extern type map rebuilt per lookup

**Opened 11-26** by skallweitNV (human, NVIDIA; no labels). Webhook → triaged same day.

**Issue:** `TypeLayoutContext::externTypeMap` is a by-value `std::optional<Dictionary<...>>`
member; every `with(...)`/`withSpecializationArgs` helper memberwise-copies the context, so
the lazy map build executes on a temporary copy and is discarded per extern lookup. Each build
walks every decl of every module dependency and mangles its name → `getLayout()` grows
(#extern lookups)×(#decls). Real-world: 1.4 s of 1.9 s first dispatch in `buildExternTypeMap`.
Key files (master layout): `layout-and-binding/slang-type-layout.h:1567`,
`.cpp:6627/6663-6719`; latent hazard: `TargetRequest::getTypeLayout`
(`slang-target.cpp:260-287`) builds a context with `programLayout=nullptr` that
`buildExternTypeMap` derefs unconditionally (cpp:6702).

**Triage (11-26):** bug / P2 / frontend (program layout & reflection). Reproduced on ToT
4ba9ae2e3 (Linux repro port: 4000 decls K=1 8.6 ms → K=64 230.1 ms); `reproduced` + Bug type
labels applied; 5-bullet comment 7193894822. Not a regression (mechanism shipped with #6450).

**Fix (11-26, slang-fixer, APPROACH A):** 5 files +192/−20, 3 commits, draft PR #14735 @
`f9fd63c` (`fix/issue-14734`, `pr: non-breaking`): map moved to `ProgramLayout` (built once per
program layout, shared across context copies), build mangles only type decls, null-`programLayout`
reflection path skips extern resolution instead of crashing. Tests: tests/bugs/gh-14734.slang
(2/2) + unit `getTypeLayoutOfExternTypeWithoutProgramLayout` (pins the null path — crashes on
master). Timing: K=64/4000-decls 363.1 ms → 9.4 ms (flat K-scaling). Full suite 16281/16312,
31 failures byte-identical to master baseline. Review APPROVE_WITH_NITS (Reviewer A 3 gaps/2
clarity applied; Devin flags all adjudicated out; combined bugs:0), nits applied at f9fd63c.

**State:** FIX-SHIPPED, parked on human review + ready-flip (weekly list; fixers can't `gh pr
ready`). Full CI runs only when a human marks it ready (draft gate). No maintainer decision
pending — no design conflict. Issue comment 7195621906 links the PR.
