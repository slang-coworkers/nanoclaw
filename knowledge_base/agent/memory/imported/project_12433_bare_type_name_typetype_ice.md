---
type: project
name: project_12433_bare_type_name_typetype_ice
description: "slang#12433 (bare type name `MyType;` as a statement → E99997 unexpected: TypeType, target-independent) — case (3) of #12428, filed by our bot 08-08. Design settled by tangent-vector 08-12/13: ALWAYS an error, via the existing coerce-to-proper-type logic. Folded into the one draft PR #12585 for #12428/#12523/#12524/#12433 (CHANGES_REQUESTED 08-17, rework 09-02, awaiting re-review as of 10-17). Discriminator is the E99997 marker, never exit 255; the regression-test template is tests/diagnostics/dangling-comparison.slang."
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1786199424980-ttxm68
---

# slang#12433 — bare type name in statement position is an ICE

Filed 2026-08-08 14:30Z by `nv-slang-bot[bot]` (the `slang-triager` edge) as the spin-off **I authorized** on the
[[project_12428_bare_func_ref_silent_dropped_codegen]] chain. Labels `Diagnostics`, `Missing Diagnostic`, `bug`,
`reproduced`.

## State (verified 2026-10-17)

**OPEN. Its fix rides on #12428's PR; there is no separate chain.** On 08-12 `tangent-vector` was assigned. He
split #12428 into three expression-statement diagnostics. This issue is **case (3)**, and he wants it as an
**error in all cases**, not a warning like cases 1 and 2 (#12523, #12524). Our bot recorded the directive in
cmt **5279135624** (08-13). The fix goes in the existing "coerce to proper type" logic, which is the
`// TODO: Implement this step.` at `slang-check-expr.cpp:3849`. The one draft PR **#12585** covers all four
issues. It got CHANGES_REQUESTED on 08-17 and was reworked on 09-02. It is now waiting for maintainer
re-review. Chase it on the #12428 record, not here.

## Repro and mechanism (at `716ec597fc`)

`MyType;` and also `int;`, `float4;`, `MyAlias;`, `RWStructuredBuffer<int>;` all give exit 255 with
`E99997 … unexpected: TypeType` from `UNEXPECTED_CASE(TypeType)` (`slang-lower-to-ir.cpp:3050`). The cause:
`CheckExpr`'s unimplemented step lets a bare type name survive checking as a `TypeType`-typed expression,
and lowering asserts that this never happens. `(MyType);` behaves differently because it dies in the
**parser** (E20002) before checking runs.

## Two corrections that bind any fix or test

- **Exit 255 is slangc's generic failure code, so it is not the crash signature.** `nosuchthing = 1;`
  (E30015) and `(MyType);` (E20002) also exit 255. **Discriminate on the `E99997` marker.** A test written
  against exit codes would pass its "already-correct" boundary cell for the wrong reason. The same trap,
  generalized: [[feedback_grep_the_error_code_when_the_exit_status_is_shared]].
- **⛔ Retracted: "E30058 is untested."** `grep -rl E30058 tests/` returns 0, but
  **`tests/diagnostics/dangling-comparison.slang` tests it** by message prose and carets. 659 of 826
  `DIAGNOSTIC_TEST` files carry no E-code, so grep the message text from `slang-diagnostics.lua`, never the
  code: [[feedback_diagnostic_coverage_cannot_be_grepped_by_code]]. That file is the **template the fix
  needs**: `a == 2;` is the diagnosing cell and `(a == 2); // ok.` is the boundary.

## Lessons this chain produced (detail lives in the linked leaves)

- The "two agents agreed on 659/826" parenthetical was struck twice and then restored. The rule: the unit of
  "what my side said" is the agent group, not one session. See
  [[feedback_the_unit_of_what_my_side_said_is_the_agent_group]].
- A stored session census expires in minutes. My "no triager session on 12433" was stale within the hour.
  Re-run `ncl sessions list` when you dispatch, and never route from a stored negative. See
  [[feedback_published_negative_env_claims_need_rederivation]].
- The bare `#12428` ref cross-linked both ways on the timeline, so the backtick failure in
  [[feedback_a_backticked_issue_ref_creates_no_crosslink]] did not repeat.

Related: [[feedback_triage_github_posting]], [[project_12430_existential_static_requirement_ice.md]] (the other
08-08 ICE, with an unrelated root cause).
