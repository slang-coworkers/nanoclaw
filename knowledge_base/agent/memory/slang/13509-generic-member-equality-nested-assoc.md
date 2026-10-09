---
type: chain
title: "slang#13509: enclosing equality constraint not applied to a nested associated type reached through substitution"
description: "Triaged as bug/medium/frontend/P2 and reproduced at 93a54974c; not a regression (fails back to v2025.1). Fix A recommended. HOLD: kaizhangNV (self-assigned) has not asked for a PR. Re-chase rechase-13509-kaizhang-405b runs 2026-10-09T07:15Z."
---

# slang#13509: `C.Primitive.Attributes` via `Input<C>` ignores `where C.Primitive == TrianglePrimitive`

**Origin.** kaizhangNV (MEMBER) opened this on 2026-10-08 and self-assigned it at 05:59:15Z (the `assigned` event
actor is kaizhangNV). The reporter says it blocks their structural-RT work. This session routed the `issue_opened`
event to slang-triager on `gh-issue-shader-slang/slang-13509`.

**Triage (slang-triager, 2026-10-08 07:10Z).** Comment
[6054577315](https://github.com/shader-slang/slang/issues/13509#issuecomment-6054577315). I verified the
`reproduced` label and Type=Bug on GitHub myself. The memo is the triager's `triage-13509.md`. The receipts below
come from the triager and I have not re-run them.
- **Reproduction:** the issue's repro gives E30027 at master 93a54974c and at e83310cf2. Every release tried, back
  to v2025.1, fails the same way, so it is not a regression.
- **Scope:** the problem is broader than fields. Any `C.Primitive.Attributes` that arrives through substitution
  stays unreduced: a field, a `let`, a generic return type, `TriangleAttributes x = …`, and calls to an `IFoo`
  generic all fail. The same type written directly in the function works.
- **Root cause** is in `slang-check-inheritance.cpp`. When the type is written directly, lookup goes through
  `C.Primitive`, which already has the equality base `TrianglePrimitive` (generic-parameter scan, :1334-1433). The
  substituted form instead needs the inheritance of `C.Primitive.Attributes` itself, and neither scan derives
  `X == Y ⇒ X.A == Y.A`. The relevant checks are the endpoint match at :1200-1211 and the exact-subject check at
  :1419.
- **Fix A (recommended):** in the lookup-derived scan, when the lookup source `X` of `X.A` has an equality base
  `Y`, add `Y.A` as an equality base of `X.A`. The triager prototyped it in about 36 lines and then reverted it.
  With the prototype, all shapes compiled, including a 3-level case; CPU values were correct and SPIR-V validation
  passed. The full suite passed 7569/7570, the one failure being gfx-smoke, which needs a GPU.
- **Open questions for review:** which witness to record for the derived equality, and cache invalidation for
  `X.A` entries computed before the constraint is checked.
- **Out of scope:** an abstract right-hand side and chained equalities. Both fail today even when spelled out
  directly.
- **Workaround:** `where C.Primitive.Attributes == TriangleAttributes`.

**Disposition: HOLD (orchestrator decision, 2026-10-08 ~07:12Z).** The assignee is a self-assigned maintainer who
has not asked for a PR, and the triage comment already offers a draft PR. This follows the same pattern as #13490
and #13419. The operator can override with GO.

**Resume.** `rechase-13509-kaizhang-405b` runs once, at 2026-10-09T07:15Z. Resume early on a non-bot comment.
- If kaizhangNV asks for a fix → send GO to slang-triager, quoting their words verbatim (Fix A plus the open
  questions).
- If they open their own PR → stand down.
- If nothing has changed → re-ask the operator once.
