---
name: project_12045_zero_cast_struct_deprecation_parked
description: "#12045 deprecate (Struct)0 cast — maintainer-self-owned tracking issue, PARKED, no GitHub post"
metadata: 
  node_type: memory
  type: project
  originSessionId: bd7a65fa-fa85-4139-b59b-bb3322c82fdc
---

**shader-slang/slang#12045** — "Deprecate legacy `(UserDefinedStruct)0` cast". Opened by **skiminki-nv** (maintainer, `Dev Opened`). NOT a bug — a maintainer self-owned tracking issue split out of the PR #11953 doc-review thread. csyonghe: "good to deprecate now"; skiminki-nv: "I'll address this in the follow-up PR #12039" ([WiP] Language reference: conversion expressions).

**The feature:** `(S)0` is a legacy HLSL-compat special case in `SemanticsExprVisitor::visitTypeCastExpr` (`source/slang/slang-check-expr.cpp:7389-7456`) that rewrites int-literal-0 cast → empty `InitializerListExpr` (= default-init `S s={}`, NOT zero-init). So `((S1)0).y` returns the field default, not 0. Fires only for C-style cast syntax, not `T(0)` ctor or implicit conv.

**Triage verdict (07-10, HEAD 29767f336):** feature-request/enhancement, severity low, P3, frontend semantic checker + language-design.
- **Approach A (recommended phase 2):** version-gated warn-now/error-later `diagnose()` at `slang-check-expr.cpp:7404`. KEY NUANCE — the zero-cast has NO Decl, so it CANNOT reuse the `[deprecated]`/`[RemovedSince]` attribute path; must be a direct version-gated diagnose reusing the `moduleDecl->languageVersion >= sinceVersion` idiom (`:389-401`). Removal version = a FUTURE `SlangLanguageVersion` (2026 already LATEST) → public-header enum append in `include/slang.h:5659-5668` (ABI-relevant).
- **Approach B (phase 1):** doc-only deprecation — already the maintainer's in-flight work in #12039.
- **Approach C (rejected):** remove outright — hard breaking change, no migration window.

**Routing decision (Main, 07-10):** PARK at needs-maintainer per self-filed-maintainer precedent [[project_11806_cmake_options_maintainer_selffix]] [[project_12035_overload_diag_reasons]]. NO auto-dispatch slang-fixer. Two decisions (removal version, HLSL-noise threshold) are maintainer language-design calls.

**GitHub:** triager POSTED the verified 5-bullet verdict (closest-to-the-state, correct per verified-verdict-posts-proactively policy): https://github.com/shader-slang/slang/issues/12045#issuecomment-4935866082. Guardrails honored — native Issue Type "Language Maturity" (human-set) + `Dev Opened` (maintainer-applied) both left untouched; no `reproduced` (working feature, not a bug).

**Re-engage IF:** maintainer explicitly requests a fixer for Approach A → slang-fixer; RE-OPEN on a substantive human comment; else stays parked. Triage memo: `/workspace/inbox/a2a-1783690442357-tprfcn/triage-12045.md` (triager's fs).

**Update (comment 4982851464, jhelferty-nv):** "@skiminki-nv I assume you'll follow up on the deprecation steps/discussion?" — maintainer-to-maintainer coordination ping (mention target = skiminki-nv, NOT our bot). Non-substantive: confirms the exact park disposition (skiminki-nv self-owns via #12039), introduces no design point. Decision: NO re-open, NO fixer dispatch, NO GitHub interjection into a two-maintainer thread. Stays parked.

**Update (comment 5032641554, skiminki-nv):** "Probably not much to follow up. I'll create a PR to deprecate this for all Slang versions and remove it from Slang 2027." — maintainer RESOLVES both blocking design calls himself + self-owns impl. Removal version = **Slang 2027**; warning scope initially "all versions". "I'll create a PR" = self-ships. Decision: stays PARKED, NO fixer dispatch, NO GitHub post.

**Update (comment 5037558755, skiminki-nv):** "This isn't actually completely trivial." Sharpened PR plan (his own, self-owned):
1. Add `SlangLanguageVersion` **2027** (public-header enum append — matches triager's ABI-relevant prediction).
2. Remove the `(MyStruct)0` special case from Slang 2027 → becomes a regular conversion. (Note: `(MyStruct)0` is *default init* in ≤2026, semantically ≠ conversion from value 0.)
3. Syntax-change warning for literal-zero→struct casts **only for struct types defined OUTSIDE the core module** — core module defines float/vector/etc. as "structs", so `(float)0` must NOT trigger the warning. ← REVIEW-CRITICAL nuance not in triager's original Approach A; the warning gate needs a `is-core-module-decl` check on the target StructDecl.
Decision: stays PARKED, NO fixer dispatch (maintainer self-ships), NO GitHub interjection (his own PR-planning thread, nothing asked of us). When his deprecation PR opens → SEPARATE reviewable-PR/mention webhook → reviewer/approver, who should watch the core-module-gating correctness point above. Nothing to pre-empt now.
