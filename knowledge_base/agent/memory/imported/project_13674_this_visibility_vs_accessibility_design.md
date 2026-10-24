---
type: project
name: project_13674_this_visibility_vs_accessibility_design
description: "slang#13674 (tangent-vector, opened 2026-10-15): language-design proposal to split scope *visibility* from *accessibility* (`this.N` in signatures, sibling-param defaults). Triager posted a factual survey at master e49310561 (comment 6210197718): no example is diagnosed; sibling-param defaults hit E99997 at call sites and a non-static `this.m` default segfaults (slang-ir-peephole.cpp:853). No fixer; parked on author's design direction. Open operator question: file the two crashes as a separate bug."
metadata:
  node_type: memory
  type: project
---

# slang#13674: visibility vs accessibility rules for `this` and parameter scopes

**Origin.** Opened 2026-10-15T18:25Z by tangent-vector. It is a design proposal, not a bug report.
It asks lookup to keep finding visible-but-inaccessible bindings (so they still shadow) and to
diagnose access to them after overload resolution.

**Routing (2026-10-16).** Routed to slang-triager on `gh-issue-shader-slang/slang-13674` with a
survey-only posture: verify current behavior at HEAD, post facts only, no classification or design
recommendation, no fixer dispatch.

**Survey (triager, verified by me as existing: comment 6210197718 by nv-slang-bot, 07:14:55Z).**
At master `e49310561`, Debug slangc:
- `int[this.N]` with a static `N` compiles, as do the static-method and implicit `int[N]` forms.
- `void g(int x = y, int y = x)` compiles; calling `g()` is E99997 "unimplemented: decl catch-all"
  (`slang-lower-to-ir.cpp:10385`). Even backward-only `int g(int x, int y = x); g(3)` hits it.
- `static int y; void f(int x = y, int y = -1)` binds the inner `y` to the sibling parameter.
- A default of non-static `this.m` / `m`, at a call relying on it, segfaults even with `-no-codegen`
  (`slang-ir-peephole.cpp:853`).
- 2026.13.1-50 behaves the same, so none of this is a #13615 regression.

These findings come from the triager. I confirmed the comment exists but did not re-run the probes.

**State.** Parked on @tangent-vector's design direction. The triager set a one-shot re-check for
2026-10-23T07:00Z. Re-engage on a human comment.

**Open operator decision.** The E99997 and segfault paths are crashes under any rule. Should they
be filed as a separate bug? Nothing has been filed. I asked the operator on 2026-10-16.

**2026-10-16T10:23Z: skiminki-nv design comment (6213400436).** Now assigned to tangent-vector. The
comment has no @-mention and asks the bot nothing; the pr_mention webhook fired anyway. It
gives four recommendations:
1. An initializer must not access the variable being declared (`int i = i + 1`).
2. Parameters are visible in order but accessible only in the body.
3. Disallow `s.c` / `this.N` (weakly).
4. Don't worry about `ITest s, int a = s.c`, which also crashes today.

Routing: forwarded to the triager to hold, with no bot post. It's a maintainer-to-maintainer design
discussion, and a bot reply would pre-empt it.

**2026-10-16T10:32Z: triager local check of skiminki-nv's cases (master ec39d3af6, nothing posted).**
skiminki-nv edited the comment at 10:26:38Z; I re-read it and the four quoted recommendations
are unchanged. These results are from the triager:
- Cases 1–3 behave as skiminki-nv described.
- Case 4 with the default argument is the same E99997 default-argument path.
- **New:** body-only `int fn(ITest s) { return s.c; }` fails with a *different* error, E99997
  `slang-ir-insts-info.cpp(47): !"Invalid op"`. It happens after checking, so it isn't about
  signature scope. The triager suspects it belongs to the class of open #12430 (existential
  reaching a static requirement), but it isn't one of the two failure paths #12430 lists. That link
  is unverified.

Operator decisions now pending:
1. Whether to file the default-argument crashes (E99997 + segfault) separately.
2. Whether the body-only `s.c` crash gets a new issue or a comment on #12430.

**2026-10-23T07:00Z: triager's scheduled re-check (verified by me on GitHub).** Nothing has changed.
The newest comment is still skiminki-nv 6213400436. tangent-vector set milestone Q4 2026 (Fall) on
10-21 and is still the assignee. #13674 is now a sub-issue of umbrella #13719. The triager posted
nothing. No separate bug exists yet for the default-argument E99997 / segfault crashes; the only
related sibling is #13720, which covers initializer visibility. Both operator decisions above have
gone **unanswered** since 10-16. The triager set no further timer, so I scheduled the one-shot
`rechase-slang-13674-r1` for 2026-11-06T07:00Z. It is re-chase 1 of 3, reserved through task-hygiene.
