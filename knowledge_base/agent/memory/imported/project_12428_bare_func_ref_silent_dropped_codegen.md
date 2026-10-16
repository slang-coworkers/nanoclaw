---
type: project
name: project_12428_bare_func_ref_silent_dropped_codegen
description: "slang#12428 (bare unapplied func ref silently dropped; a missing () on a barrier removes the barrier, 0 diagnostics) — design SETTLED by @tangent-vector 08-14 and split into #12523/#12524 (+ ICE #12433). One draft PR #12585 closes all four. CHANGES_REQUESTED 08-17; rework pushed 09-02 with 4 calibration questions; awaiting maintainer re-review (verified 10-16). Root cause = the // TODO at slang-check-expr.cpp:3849."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12428-routing
---

# slang#12428 — bare unapplied function reference silently accepted and dropped

Filed 2026-08-08 by `nv-slang-bot[bot]` from a Discord report (wide0125). `GroupMemoryBarrierWithGroupSync;`
without `()` removes the barrier: a silent data race from one missing character, with no diagnostic on
any target.

## Current state (verified 2026-10-16)

- **Design settled on the issue.** At the bot's ask (`5226554214`), `tangent-vector` answered
  (08-14 17:30Z), asking for a convenience wrapper around `CheckExpr` for statement-like contexts. The
  work split into **#12523** (case 1: restrict expression-statement forms), **#12524** (case 2:
  unused-result) and **#12433** (case 3: bare type name ICE, [[project_12433_bare_type_name_typetype_ice]]).
  All three are OPEN.
- **One PR, draft #12585** (`fix/issue-12428`, head `c5d38917`), which closes #12523, #12524 and
  #12433 and fixes #12428. `tangent-vector` filed **CHANGES_REQUESTED 08-17** (wrong factoring), then
  pinged 08-24 asking for an update. The bot pushed the rework on 09-02: a new core
  `checkExprInStmtLikeContext`, 9158/9169 passing, a `[NoDiscard]` regression it had introduced fixed.
  It also posted **four calibration questions**: comma-LHS warnings in value context; ternary/`&&`/`||`
  transparency; `cond && (a=1)` drawing E30074; `(a==2);` now drawing E30058.
- **Waiting on the maintainer's re-review since 09-02.** No PR activity after that. The chain owner is
  `slang-fixer`, reached through `slang-triager` on `gh-issue-shader-slang/slang-12428`. Parallel
  dispatch to the same peer mints duplicate sessions.
- The 08-08 fork-gate (series `i12428-fork-gate-52aa`, script `/workspace/agent/.i12428_fork_gate.sh`)
  existed to catch the maintainer's answer, which came 08-14, so its job is done. `ncl tasks get` from
  Main reports it not found on 10-16. That alone doesn't prove it's gone
  ([[feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group]]), but it no longer matters.

## Root cause (verified on my own clone 08-08)

- `slang-check-expr.cpp:3849` has a literal `// TODO: Implement this step.` where `CheckExpr` should
  make sure the expression "names a value and not a type". That TODO is the whole bug.
- `maybeResolveOverloadedExpr` (`:1601-1608`) resolves only `OverloadedExpr`; every other shape hits
  a bare `else { return expr; }`.
- `slang-lower-to-ir.cpp:3041` lists `UNEXPECTED_CASE(TypeType)` under "types we do not expect in
  ASTs that have passed front-end semantic checking". Lowering asserts an invariant that nothing
  establishes, which is why the #12433 ICE independently justifies a check-time fix.

## Constraints the fix had to carry (from triage; most are now in #12585)

- Cover all four shapes: `(addOne);`, a bare member method `s.m;`, a bare variable `a;`, and a
  lambda as a statement.
- Key on discarded expression-**statement** position, never on "the expression has FuncType". The
  FuncType key breaks `functype` names passed as arguments and `__fwd_diff(sq)(...)`.
- `[NoDiscard]` cannot be the primary fix: `maybeDiagnoseDiscardedNoDiscardResult` only inspects
  `InvokeExpr`.
- The two candidate sites disagree about parentheses. The dangling-`==` check doesn't peel
  `ParenExpr`; the NoDiscard check does. The fix has to choose (#12585 now gives `(a==2);` E30058).
- **Tests assert on the `E99997` marker, never the exit code.** 255 is slangc's generic failure code,
  shared by `(MyType);` (a parse error) and `MyType;` (the ICE)
  ([[feedback_an_identifier_that_does_not_distinguish_its_members]]). The boundary cell is a
  parse-error cell, not an accepted-silent one ([[feedback_diagnostic_coverage_cannot_be_grepped_by_code]]).
- Precedents, blamed against the remote: dangling-`==` came from #11493 (06-12), `[NoDiscard]` from
  #11520 (06-16). A shallow-clone `git log -S` misattributed both to the graft root.

## Dedup and provenance

- **Not a duplicate of #12378** (the #12367 emit-time FuncType check): the bare form leaves no
  function-type artifact to inspect, because the uncalled global is DCE'd before emission
  ([[project_12367_functype_kernel_emit_armed_cotrigger]]). A backticked ref created no cross-link
  between them ([[feedback_a_backticked_issue_ref_creates_no_crosslink]]).
- The 5 prior shared learnings on this bug came from the same bot identity that filed it: one prior,
  not five observations ([[feedback_sibling_write_under_shared_bot_identity]],
  [[feedback_two_tiers_one_frame_is_shared_prior]]).
- Unfiled third finding: `let f = addOne;` is accepted, then `f(5)` fails with E33070.
