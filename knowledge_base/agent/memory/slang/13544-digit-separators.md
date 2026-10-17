---
type: chain
title: "slang#13544: C++14 ' digit separators in numeric literals"
description: "CLOSED 10-13 by the reporter (completed): maintainers refused ' because _ is already supported. Still live: draft #13547 (float _, Part of #13544) blocked by skiminki-nv, and draft #13546 (#if literal decoding + SIGFPE guard, Fixes #13545); CI on both waits on falcor-ci approval. Final re-chase 10-16 16:00Z found no change. PARKED on an inbound; no re-chase scheduled. History in [[slang/13544-history-triage-to-close.md]]."
---

# slang#13544: `'` digit separators

**Outcome.** damster101 (external) asked for C++14 `'` separators on 2026-10-09. tangent-vector refused on 10-12
(6130273967: close it, "`_` as a digit separator is already supported"; "Slang is not C++"), skiminki-nv agreed, and the
reporter closed it on 10-13 09:07Z (completed). The `'` request is **terminal**.

**What we measured (still true on master).** `_` is accepted in integers, including `123_`, `1__0`, `0x_FF`; there is no
placement rule (`slang-lexer.cpp:703` TODO). Floats reject `_` (`1_000.5f` → E20001). `0b1_2` → 4 and `07_9` → 65
silently. `#if` decodes literals with strtoll, so `#if 1_000 == 1` is true and `0b`/`0X` literals misdecode; `#if
INT_MIN / -1` crashes slangc with SIGFPE. The spec's `_` text is non-normative.

**Still live.**
- **#13547** draft `fix/issue-13544-float-sep` @ `6c65eea6c4`, `Part of #13544` (no closing keyword), `pr: breaking
  change` (it turns `0b1_2`/`07_9` into E10003). skiminki-nv **blocked** it (6121612803) pending the separator decision,
  then suggested exactly this float-`_` scope (6140951497) but has not lifted the block. Open questions in the body:
  placement (`1._5`, `1e_5`, `1.5_`) and the E10003 break. Make no pushes or review asks.
- **#13546** draft `fix/issue-13545` @ `911a570b41`, `Fixes #13545`, breaking, includes the SIGFPE guard; jkwak-work
  assigned, 0 reviews. #13545 is open.
- Both are owned by slang-fixer `sess-1791561994184-c25n6k`; triager on `gh-issue-shader-slang/slang-13544`.
- **CI:** dispatch runs 38010557763 / 38014317927 `waiting` on the **falcor-ci** environment since 10-10 (needs a
  ci-approver; current_user_can_approve=false). `pull_request` runs are skipped as drafts.

**Parked (10-16 16:00Z).** The final re-chase `rechase-13544-tv-6b49` found nothing new. The operator never answered the
10-12 CLOSE/KEEP/NARROW question for #13547; treated as KEEP and not re-asked. No further re-chase. Resumes only on an
inbound: skiminki-nv on #13547, a review on #13546, or a falcor-ci approval.

**History** — triage, the disposition and both drafts, every maintainer comment and our replies, the close, the final
re-chase: [[slang/13544-history-triage-to-close.md]].
