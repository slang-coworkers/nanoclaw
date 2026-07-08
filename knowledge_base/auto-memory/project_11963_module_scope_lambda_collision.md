---
name: project_11963_module_scope_lambda_collision
description: IN-FLIGHT —
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b31b10e-fa48-4afa-bc9a-17cecc3d48d3
---

**shader-slang/slang#11963** — "Attribute with an IFunc member can not be declared more than once." Filed by ShiinaManatsu (external), v2026.12.

**Bug (verified, not attribute-specific):** any two lambdas at MODULE/global scope collide on the shared synthesized struct name `_slang_Lambda_` → `error[E30200]` conflicting declaration. The `[When(()=>true)]` user-attribute is incidental; minimal repro `IFunc<bool> g1=()=>true; IFunc<bool> g2=()=>true;` also fails. Reproduced on TOT `55b2530c6`, GPU-free, deterministic.

**Root cause:** `SemanticsExprVisitor::visitLambdaExpr`, `source/slang/slang-check-expr.cpp:7854-7867`. Func-scope branch (`m_parentFunc` set) appends `<funcName>_<counter>` disambiguator; global-scope `else` branch adds the `LambdaDecl` to the module container with the BARE name — no counter. Name-keyed redeclaration check (`slang-check-decl.cpp:13727/13765`) then flags the collision.

**Classification:** Bug / medium / frontend (semantic checker) / P2.

**Chain state (2026-07-07):** slang-triager reproduced, root-caused, posted verified verdict to GitHub (comment 4900977721), set `reproduced` label + Issue Type=Bug, and **handed off to slang-fixer** (peer-wired) on canonical thread `gh-issue-shader-slang/slang-11963` with memo `triage-11963.md`. Recommended **Approach A**: append a counter in the global-scope branch, mirroring the func-scope path (smallest change, fixes the producer). Approaches B (dedicated monotonic counter) / C (exempt synthesized decls from redecl check) documented as alternatives.

**FIX LANDED (07-07 ~07:38):** slang-fixer implemented Approach A — draft **PR #11965** (https://github.com/shader-slang/slang/pull/11965), labeled `pr: non-breaking`, 2 files +23/−0. Global-scope branch of `visitLambdaExpr` now appends `getDirectMemberDeclCount()` to `_slang_Lambda_`. New test `tests/language-feature/lambda/lambda-global-scope.slang` (two module-scope lambdas). Revert-drill verified (revert → E30200 reproduces); lambda suite 24/24; formatting clean; codex PLAN/CODE/OUTPUT all approve. Fixer dispatched slang-reviewer (Mode: pr) — a2a edge not live, routed via nanoclaw send. CI: manual workflow_dispatch run RED = benign priority-yield (only wait-for-human-priority + check-ci fail, builds skipped); `retry-yielded-bot-ci` reruns for real signal — see [[project_bot_pr_priority_yield_red_run]].

**Main's role:** do NOT double-dispatch to fixer (triager owns the peer-wire). 07-07 items both CLOSED: (a) triager refreshed GitHub verdict comment 4900977721 in place to reference draft #11965 (draft-held observability [MUST] satisfied); (b) `report_pr_created({repo, 11965})` CONFIRMED fired + proven live (a `github.ci_failed` webhook for #11965 already routed into the fixer's session — that's how the priority-yield was triaged). Awaiting reviewer verdict + real CI, both of which the fixer owns on the branch via webhook. Ready-flip + merge remain operator-gated; NEVER auto-close. See [[feedback_no_double_dispatch_peer_wired]] [[feedback_verify_report_pr_created]] [[feedback_drafts_only_guardrail]] [[feedback_github_comment_hygiene]].
