---
type: project
name: project_13579_generic_struct_capability_outside_entrypoint
description: "slang#13579 (kaizhangNV): [require(...)] on a GENERIC struct not enforced outside entry-point signatures. Bot draft PR #13616 (Part of, pr: breaking change) @0d77282d3d, DIRTY after #14051. PARKED on the author's core-module-intrinsic scope answer + a human CI release (run 40804024110 waiting). Supervisor register keeps the timer."
metadata:
  node_type: memory
  type: project
---

# slang#13579 — generic struct capability requirement missed outside entry-point signatures

Current-state record. The dated log (10-12 → 11-04) is in
[[project_13579_generic_struct_capability_outside_entrypoint_history]]; **new dated entries go there, not here.**

## The bug

`[require(metal)] struct MetalOnly<let N:int>` used as `uniform MetalOnly<3> input;` and passed to `read<T>(T)` from
a compute `main` compiles clean for `-target hlsl` (expected E36107); the non-generic form errors correctly. Cause
(author's, triager-confirmed): `SemanticsDeclReferenceVisitor` (`slang-check-decl.cpp`) only calls
`processReferencedDecl()` for `DirectDeclRef` (`visitDirectDeclRef`, `:1387`), so a `GenericAppDeclRef`'s inner
`StructDecl` requirement is never collected. `collectGenericStructTypeUses()` (`slang-check-shader.cpp`, PR #11770
for #9489) compensates for entry-point signatures only. Missed shapes: uniform field read, local,
`StructuredBuffer<MetalOnly<3>>`, signature-only helper, `Outer<3>.In`; only `.init` construction was caught.
Labels: `bug`, `Missing Diagnostic`, `reproduced`, `Capability System`. Triage: bug / medium / P2 / frontend.
Milestone Q4 2026 (Fall). Related, not duplicates: #13637 (names #13579 "Related"), #13995 (author's
generic-interface regression, tracked separately, not covered by #13616).

## Current state (as of 11-04 17:00Z)

| Item | State |
|---|---|
| Issue #13579 | OPEN, assignee kaizhangNV. Last comment: bot **6483531725** (edited 10-29 02:29:45Z). |
| PR #13616 | Bot draft, "Part of #13579", `pr: breaking change`, head `0d77282d3d`, 23 bot commits, 7 files +891/−103, 0 reviews, closingIssuesReferences `[]`. |
| Merge state | **DIRTY** (ahead 23 / behind 50): #14051 (kaizhangNV, merged 11-04 06:39Z) touches all 3 source files. |
| CI | Run 40804024110 `waiting` (workflow_dispatch): needs a human release. |
| Sessions | triager `f7n4ns`, fixer `sess-1791911926955-vychna` (holds the PR mapping; worktree `wt-slang-13579`, branch `fix/issue-13579`), reviewer `hin6ce`. Canonical thread `gh-issue-shader-slang/slang-13579`. |
| Timer | Supervisor register (`awaiting_human`); no one-shot pending (`recheck-13579-fixer-and-3b9c` fired 11-04 17:00Z). |

**Open question to kaizhangNV:** fix the core-module `[require]` declarations and check core-module intrinsic
generics (CoopVec, RWSB, …) in user code inside #13616, or as a follow-up?

**Next move when it resumes** (author's scope answer or an operator go-ahead): the fixer merges master (no rebase),
resolves the 3-file conflict, and turns the PR body's fork recipe into in-tree edits that re-enable the 4 checks
#14051 landed in master (`tests/ray-tracing-2/frontend/{diagnostics/stage-intrinsic-capability,
capabilities/callable-dispatch-stage, diagnostics/cross-stage-input, capabilities/multilevel-acceleration-metal-only}.slang`).
Fork PR kaizhangNV/slang#25 says those checks "remain deferred under shader-slang/slang#13579". The fork's
`trace-dispatch-stage` annotation (location 30:51 → 30:16) is the author's to update.

## Fix shape (PR #13616)

- **Scope:** user aggregates reached through a non-direct decl-ref (prototype E4), later widened to user enums and
  interfaces, plus non-generic structs in entry-point signatures (incl. behind a field wrapper) and `Outer<3>.In.make()`.
- **Exclusion:** magic/`__intrinsic_type` generics are skipped **only when they come from the core module**
  (`isFromCoreModule`). That keeps 0 new core/standard-module diagnostics while the fork's standard-module
  `rt::MultiLevelAccelerationStructure` (`[require(metal)] __intrinsic_type`) now rejects. The author's "the general
  capability checks should own these cases" (cmt 6482890268) was read as the scope answer for standard-module types.
- **Held:** reviewer R4 item N2 (skip core-module intrinsics only while checking core-module code). On
  `drill/13579-n2` it fails 7 runs, 3 of them false rejects of valid code (`OutputPatch` domain shader; `__SubpassImpl`
  at `hlsl.meta.slang:6711/:24086`). It is safe only after those core-module `[require]` declarations are fixed, and
  adopting it would answer the author's open question for them.
- **Last measured (fixer's, 10-29):** 54/54 PR test files (master 25/54); 1199/1199 capability + diagnostics +
  workgraphs; full suite 11258/11261 (3 fp8-cuda env); 4/4 fork runs reject; ray-tracing-2 260/261.
- Behaviour change: new E36107/E36104 on previously accepted code (hence `pr: breaking change`).

## Decisions and lessons

- **Routing:** the issue was self-assigned (default hold), but the author's *"@nv-slang-bot please look at this
  issue"* (6132482141) released it ([[feedback_deadpromise_check_assignee_before_rewake]]); later author comments without an @-mention still carried post authorization
  because they answer the bot on a chain the author opened by @-mentioning it.
- **"Part of" needs a clean body:** a body line "Open question (blocks merge): Fixes #13579, or keep…" made
  `closingIssuesReferences` = [13579]. Reword with no close verb before the number, then confirm the list is empty.
- **Inert `-NOT` annotations:** `//SCOPE-NOT: E36107` in `tests/diagnostics/capability-generic-struct-entrypoint-param.slang`
  is vacuous because `diagnostic-annotation-util.cpp` matches only `//PREFIX:` / `/*PREFIX:`. 16 other test files have
  the same inert lines (harness gap, unfiled, operator's call).
- **Blanket fix is wrong:** processing `getDecl()` for every `DeclRefBase` gives 57 core-module diagnostics (50 when
  limited to generic structs, all from RWStructuredBuffer / TensorLayout / CoopMat / CoopVec). The author ruled out
  fixing it by adding redundant annotations to consuming APIs.
- **Fork-only tests:** gh/MCP return 401 on the author's fork (token scope); raw.githubusercontent works. An upstream PR
  cannot re-enable a fork-only test; #14051 has since moved the 4 tests in-tree.
- slang-test needs libslang-llvm on `LD_LIBRARY_PATH`, or filecheck tests are silently skipped (triager's learning).
- Update the reviewed PR by merging master, never rebase + force-push ([[feedback_update_reviewed_pr_by_merge_not_rebase]]).
