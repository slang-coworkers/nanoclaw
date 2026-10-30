---
type: chain
title: slang#14038 — `a -= b` not synthesized from a user `operator-`
description: Human-filed (albertrodriguezclo) 2026-10-29 17:10:23Z, same reporter as the cloth-sim batch #14026–#14031. Triaged feature/low/P3, recommendation A (diagnostic note). Parked on maintainer direction under R6; triager one-shot t-bb303f posts 2026-11-02 17:10:23Z.
tags: [operators, overload-resolution, diagnostics, feature-request, r6]
---

# slang#14038 — compound assignment from a user binary operator

**Ask.** For a user struct with a free `operator-`, `x -= y` fails: "no overload for '-=' applicable"
(E39999), with candidate notes for the builtin `__BuiltinArithmeticType` overloads. The workaround is a
hand-written `void operator-=(inout S3 x, S3 y) { x = x - y; }` for every operator and type. The reporter asks
for either synthesis of `x op= y` as `x = x op y` when no `op=` exists (as C# does), or a diagnostic that
suggests the workaround.

**Dispatch (10-29).** Sent to slang-triager on thread `gh-issue-shader-slang/slang-14038`.
- R6 applies: human-filed, no labels, and the fences hold a diagnostic, not a crash.
- Earliest bot comment: 2026-11-02T17:10:23Z.
- The triager may triage now; posting waits for a one-shot `--process-after` task.

**10-29 17:13Z.** The triager reproduced E39999 on a local master build (its finding) and acknowledged the R6 hold.
17:15Z: the triager says #11627 (flag-enum `|=`) is a prior gap with the same root mechanism (its finding, not verified).

**Triage (slang-triager, 10-29 17:46Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
- Classification: feature-request / low / frontend (overload diagnostics, core module, spec) / P3. Not a duplicate.
- Mechanism: the parser makes `x -= y` a call to a function named `-=` (`slang-parser.cpp:8228-8251`). The checker
  does a scope lookup, then `ResolveInvoke` (`slang-check-overload.cpp:3633`). Nothing rewrites it to `x = x - y`. Core
  `kCompoundBinaryOps` (`core.meta.slang:3378-3437`) covers only the sealed `__Builtin*Type`s. The spec has no derivation rule.
- Workaround: a free `operator-=(inout S3, S3)` compiles. A member, static, or extension `operator-=` gives E30073 (since #12781).
- Options: A is a note after E39999, gated on the binary op resolving, coercing to the LHS type, and the LHS being a writable
  l-value. B is C#-style synthesis, which needs a language/spec change and single evaluation of the l-value. C is to land #12765
  (conforming types only). D is docs.
- Recommendation: A (+D). B is a decision for the language maintainers.
- Related: #11627 (closed, flag-enum `|=`); #12591 / PR #12765, which I verified is OPEN with CHANGES_REQUESTED, last updated
  09-09, tracked by the supervisor under the #12591 chain and waiting on a tangent-vector re-review; #12773 and #5254.
- The memo is a local copy, not linked (raw a2a attachment): `/workspace/inbox/a2a-1793295985773-woly8b/triage-14038.md`.

**GitHub (verified 10-29 17:4xZ).** Type=Feature (set by the bot at 17:17Z), no labels, 0 comments.

**Timer.** One-shot `t-bb303f`, process_after 2026-11-02T17:10:23Z, with a `date -u` guard. It re-checks labels, the
timeline, and any reporter PR before it posts. A duplicate, t-569ee2, was cancelled. All three facts come from the
triager: a task in a peer group cannot be seen from Main.

**Open decision (operator).** Hand A to slang-fixer now, with no PR that references #14038 before the R6 lift? Or wait for
maintainer direction after the 11-02 post?

**Next.** Owner: slang-triager on thread `gh-issue-shader-slang/slang-14038`.
