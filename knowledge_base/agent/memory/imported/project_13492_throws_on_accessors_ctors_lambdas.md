---
type: project
name: project_13492_throws_on_accessors_ctors_lambdas
description: "slang#13492 (skiminki-nv, self-assigned, opened 2026-10-07): feature request for `throws` on accessors, subscripts, __init and lambdas. Triaged by slang-triager as feature/medium/P2, design-gated, NO fixer (comment 6043910204). It is an umbrella over siblings #13488-#13491, which are all self-assigned by the same author. Open operator decision: should we file the generic error-type bug (E30095/E30093) on its own? Re-chase task rechase-13492-throws-des-d113 runs 2026-10-14."
metadata:
  node_type: memory
  type: project
---

# slang#13492: `throws` on property accessors, subscripts, constructors and lambdas

**Origin.** Opened 2026-10-07 by skiminki-nv (MEMBER, self-assigned). It is the umbrella for four sibling issues
from the same author on the same day, all self-assigned:
- #13488: `try` on a non-throwing ctor or subscript is not diagnosed
- #13489: an error escaping an accessor body crashes the checker
- #13490: `try` inside a lambda is checked against the enclosing function
- #13491: one `try` covers every throwing call in its operand

Each issue has its own slang-triager session, and #13488 and #13489 also have slang-fixer sessions. Those siblings
were routed by other Main sessions, not by this one.

**Triage (2026-10-07 18:09Z).** Comment 6043910204, Type=Feature, no labels. All 6 E20001 shapes reproduce at
master 9f31ffcfd. Findings beyond the issue body:
- `LambdaExpr` is not a `CallableDecl`, so lambdas do need an AST change.
- Generic error types are broken (see below).
- Accessor conformance ignores error types entirely, while method conformance requires an exact match or a
  synthesized wrapper.
- Implicit ctor calls and getter→setter write-back have no `try` site.
- The clause order in the body (`-> T throws E`) is the reverse of the existing order.

The triager's memo has the file:line digest. The triage scratch is at `/workspace/agent/scratch-13492` (in the
slang-triager workspace).

**Disposition: design-gated, maintainer-owned, NO fixer.** The design questions are: setters in or out, the accessor
conformance rule, the lambda error type, the clause order, and throwing `IFunc` variants.

**Open operator decision: file the generic error-type bug separately?** When a callee is generic over its error
type, `int f<E>(int) throws E`, then `try f<MyError>(x)` gives E30095, and under a matching `catch` it gives E30093.
I verified the cause at 9f31ffcfd: `visitTryExpr` (slang-check-expr.cpp:7782-7817) compares
`funcCallee->errorType` unsubstituted, where it should use `getErrorCodeType(astBuilder, declRef)`
(slang-syntax.h:601). This is long-standing (2025.23.2) and independent of #13492. No existing issue matched a
search on E30095 or on generic error types. It is already described in the #13492 triage comment, point 2.
I asked the operator via ask_user_question at 2026-10-07 ~18:15Z and it timed out after 600s with no answer. The
triager was told to hold, so nothing has been filed.

**Resume path.** `rechase-13492-throws-des-d113` (once, 2026-10-14 18:00Z) checks for non-bot comments, relays any
maintainer direction to slang-triager on `gh-issue-shader-slang/slang-13492`, and re-asks the filing question if it
is still open. Resume early on a non-bot comment or an operator answer.
