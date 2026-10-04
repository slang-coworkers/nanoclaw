---
name: project_11877_operator_overload_fastpath
description: "slang#11877: user-defined global `operator OP` on builtin scalar/vector/matrix types silently dropped since v2026.11 (first-bad #11493, author csyonghe). Approach A (#11879) REJECTED by jkwak → diagnostic DRAFT PR #12162 (decl-site error), maintainer-gated, untouched since 2026-07-21 (re-checked 2026-10-03). Discussion #11840 reply still unposted: the App lacks Discussions:write. Three retractions on this chain (bisect fooled by a cached version string, wrong @-mention, untested JS claim)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a8a12da-1dd6-48d9-ab11-aec7ef0d4c0b
---

# slang#11877 — user operator overloads on builtin types silently dropped

**State (re-checked 2026-10-03):** issue OPEN; **#12162 OPEN, draft**, 0 comments, 0 reviews,
last updated 2026-07-21; Discussion #11840 open and unanswered by us. **Healthy maintainer-gated
hold** — no Main action unless one of the resume triggers below fires.

## The bug

A user-defined global `operator OP` whose parameters are builtin scalar/vector/matrix types (e.g.
`float4x4 operator*`) has been ignored since v2026.11: `a*b` resolves to the builtin operator, the
overload is never called, and there is no diagnostic. **First-bad = #11493** (`61ad43dbc`,
"Hard-code a fast path for builtin scalar/vector/matrix operators", author **csyonghe**),
confirmed by symbol-checked GOOD→BAD builds (parent `956f6ed52` honours the overload). The
mechanism is front-end and target-independent: `visitInvokeExpr` (`slang-check-expr.cpp`
~5007) returns the `BuiltinOperatorExpr` fast path before overload resolution (~5044); only the
matrix deferral is GLSL-scope-gated.

## Timeline

- **07-02:** fix PR #11879 (Approach A — defer to overload resolution when a non-core user
  operator is in scope). jkwak flipped it ready; design question went to office hours for
  csyonghe.
- **07-15 design flip:** jkwak (issuecomment-4985591226) — user code is **not** supposed to
  override builtin matrix multiply. **Approach A rejected**; he closes #11879. New directive: a PR
  that emits a **diagnostic** instead of dropping silently; `-allow-glsl` for the matrix-mul use.
- **07-20: #12162** (branch `fix/issue-11877` reused, `pr: breaking change`, `Closes #11877`).
  Rejects the overload **at the declaration site** (`checkOverloadedBuiltinOperatorDecl` from
  `checkCallableDeclCommon`), reusing the fast path's own `getBuiltinArithmeticCommonType` +
  `isFastPathedOperandFor` so the rejected set matches exactly what the fast path shadows. New
  diag `cannot-overload-builtin-operator-on-builtin-operands` (30073), suppressed in GLSL scope
  for matrix ops + vector equality. 5 tests. Reviewers csyonghe + jkwak were requested by human
  maintainer jhelferty-nv, not by the bot. `report_pr_created(12162)` called; issue footprint
  issuecomment-5022454595.

## JS/WASM workaround gap

brussig-tud's real use case is the JS/WASM frontend, which cannot set `-allow-glsl` or enable the
glsl module. Full mechanism: [[reference_slang_two_glsl_switches_unreachable_from_wasm]].
Answered on the issue in comment 5022342835 (07-20), with the gap `@jkwak-work`-flagged as his
design call — no fix or timeline promised.

**Discussion #11840 reply BLOCKED.** jkwak @-mentioned the bot there (discussioncomment-17654002)
asking for a JS snippet; the honest answer is that none exists. Posting fails: the App lacks
`Discussions: write` → [[project_bot_discussions_write_permission_gap]]. Escalated to the
operator 07-16. The reply body was saved on the triager side
(`/workspace/agent/active-work/discussion-11840-reply.md`). Node IDs: discussion
`D_kwDOBZiKEc4And-U`, jkwak's comment `DC_kwDOBZiKEc4BDWDy`, thread root `DC_kwDOBZiKEc4BDWCA`.
brussig has since replied there (17659429, 07-16: "I don't think compiler options can be set
from JavaScript"), which matches our finding.

## Three retractions on this chain

1. **Bisect fooled by a cached version string.** The triager's interim "predates #11493" was
   wrong — slangc's CMake version string was stale. Symbol-checked builds settled it. Cf.
   [[feedback_a_binary_mtime_is_a_build_date_and_cannot_date_an_install]].
2. **Wrong @-mention.** Our verdict (4852879346) credited #11493 to @skiminki-nv; jkwak caught it
   (4895184179). Edited in place to csyonghe. Verify an @-mention's identity on the PR/commit
   before posting.
3. **Untested positive claim.** Bot comment 5021127531 (07-20) said `import glsl;` works flag-free
   from JS. It was extrapolated under a standing "answer instantly" instruction, contradicted the
   citations already in hand, and was refuted by brussig's repro. **"Answer instantly" means post
   the verified facts you have, never a new capability claim you haven't tested.** The same false
   claim reached the #12162 PR body via the slangc/slang-test `enableGLSL=true` harness trap;
   fixed by force-push `aca1d2df82`, body re-verified 07-20 12:54Z.

Also: brussig once deleted their own comment (4985669814) before we replied. We held: a
withdrawn comment is not a live question. The re-ask (5022293066, with a real bot mention)
authorised the post.

## Resume triggers

- A review, CI or comment webhook on #12162 (routes to the fixer via `pr_session_mappings`).
- A fresh substantive comment from brussig or jkwak on #11877 → triager, citations in hand.
- The App gains `Discussions: write` → triager posts the saved #11840 reply.
- #11879 is jkwak's to close, not ours.
