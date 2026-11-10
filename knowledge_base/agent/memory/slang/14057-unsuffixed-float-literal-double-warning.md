---
type: chain
title: slang#14057 — warn when an unsuffixed float literal loses precision before use as double
description: Human-filed (albertrodriguezclo, CONTRIBUTOR) feature request 2026-10-29 21:51:32Z, cloth-sim batch. Triaged feature/low/P3, reproduced, not a regression. Parked comment posted 11-02 21:58Z (6589504025). PARKED on jkwak-work (assignee) + skiminki-nv design decisions; re-check t-aec81c 11-09 22:00Z.
tags: [diagnostics, float-literal, feature-request, parked, r6]
---

# slang#14057 — unsuffixed float literal rounded to float, then widened to double

**Ask.** Slang types unsuffixed floating literals as `float` (HLSL rule, #1185). Ported C/C++/CUDA code assumes `double`.
`10e+16` passed to a `double` param, used in a `double` expression, or in `float(m * 10e+16)` is rounded to float with no
warning (E30082 fires only for some shapes, e.g. a literal inside `?:`). Request: warn when a literal that is not exactly
representable as `float` is converted to `double`; suggest the `l` suffix. Reporter's master: 43ac12323.

**GitHub state (10-29 21:5xZ).** 0 comments, no labels, no Type, no assignee.

**Dispatch (10-29).** slang-triager, thread `gh-issue-shader-slang/slang-14057`. R6 applies: no `bot-ok`, no crash word,
so no bot comment before **2026-11-02T21:51:32Z**. Setting Type/labels is allowed.

**10-29 21:55Z.** The triager acknowledged and noted the R6 hold. It is reproducing on master 977df1246 and tracing literal typing and the E30082 sites.

**Triage (slang-triager, 10-29 22:09Z, master 977df1246). These are the triager's findings; I did not reproduce them.**
A, B and C emit the rounded value with no warning; D is exact. Not a regression (same output on 2026.10.2 and 2026.11).
- The lexer types an unsuffixed literal as `Float` and parses it as float (`slang-lexer.cpp:1273/1332`), so only the token text keeps the exact value.
- E30082 (`slang-check-conversion.cpp:3006-3015`, #2802) is a *performance* warning.
  It fires only at `CoercionSite::Argument` and skips a bare `FloatingPointLiteralExpr`.
  That is why `?:` (and `(lit)`) warns while A and B do not.
  C is float*float, so no conversion exists for a warning to see.
- Recommendation: a NEW value-gated warning in the `_coerce` block next to E40016 (`:2884-2945`).
  That block runs at all four implicit sites and skips the core module.
  Retyping the literal from context would reverse #1185/#1202.
  Case C would need an opt-in lint.
  The fix must change `docs/user-guide/02-conventional-features.md:67` ("Decimal literals do not trigger rounding warnings").
- The 4 decisions for skiminki-nv (literal-rewrite #11513 owner): default-on or pedantic; is an explicit `f` exempt; is explicit `double(lit)` in scope; is a lint for C wanted.

**GitHub state (verified 10-29 22:1xZ).** Type=Feature, label `reproduced`, 0 comments (R6 held).

**Next.** The triager reports a one-shot `t-b1d19a` at 2026-11-02T21:56Z. It posts the parked comment (draft in the triager's `memory/issues/comment-14057.md`), or posts a delta and hands off to slang-fixer if a maintainer has replied. I have not checked the task myself; `ncl tasks get` from Main cannot see it.
Sibling: [#14062](14062-generic-float-literal-rounds-through-float.md) (generic `T(0.1)`) is its own chain, and the "explicit `double(lit)` in scope?" question overlaps it.
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14057`. Memo: `/workspace/inbox/a2a-1793311770174-20ombi/triage-14057.md`.

**11-02 21:58Z: the R6 re-check ran.** The triager posted the parked triage comment as nv-slang-bot (6589504025; I verified it exists).
The comment asks @jkwak-work and @skiminki-nv for the 4 decisions. jhelferty-nv assigned jkwak-work at 18:42Z; I verified the assignee.
There is still no human comment. The 4-day hold I gave in the 10-29 dispatch came from the stale R6 rule, which is retired (see Core Memory).
⚠️ Stale bot draft PR **#12932** (`fix/issue-12930`, last updated 09-07) edits the same E30082 block. Whichever change lands second has to be adjusted.
**Next.** The triager's one-shot `t-aec81c` runs 11-09 22:00Z. If a maintainer replied, it posts a reply and hands off to slang-fixer.
If nobody replied, it does nothing and the chain stays parked with no timer (the GitHub comment is the resumable artifact).

**11-06 22:58Z: the reporter answered the 4 questions** (albertrodriguezclo, CONTRIBUTOR, comment 6697883772). The comment has no @nv-slang-bot mention, though it arrived as `pr_mention`. Their user-side view:
(1) on by default; (2) an explicit `f` is exempt; (3) explicit `double(10e+16)` is in scope, which also covers the `T(0.1)` part left from #14062; (4) case C as an opt-in lint only. The message should suggest the `l` suffix.
**This is not a maintainer decision.** jkwak-work (assignee) and skiminki-nv have not commented. I relayed it verbatim to the triager owner session `sess-1793310877855-axf4gg`, with no post authorization. The 11-09 `t-aec81c` re-check still waits for a maintainer.

**11-07 00:29Z, triager scope note (the triager's finding; I did not verify it).** The reporter's answers are now in `triage-14057.md`; the wait plan is unchanged.
- Explicit `double(10e+16)` is cheap to cover. It takes the explicit-cast path into the same check block (`slang-check-overload.cpp:3655`), so the new warning only needs to run for explicit casts too.
- ⚠️ **Generic `T(0.1)` is NOT covered by the planned #14057 fix.** At check time `T` is unknown, and the call has no conversion to hook. Covering it needs a separate mechanism, either a generic-context rule or a check at specialization time.
  #14062 / PR #14218 leaves unsuffixed `T(0.1)` to #14057, so **neither chain covers it now**. The triager recommends a separate follow-up issue and will raise it when a maintainer replies.

**11-09 22:02Z: `t-aec81c` ran, and nothing changed** (I verified: 2 comments, last update 11-06; assignee jkwak-work). No maintainer has replied on #14057, #14062 or PR #14218. Nothing was posted or handed off.
**The chain is parked webhook-only with no timer.** It resumes on a maintainer reply or a `Fixes #14057` PR. The amended brief is in `triage-14057.md`.
The register entry in `supervisor-state.json` was updated 11-09.
