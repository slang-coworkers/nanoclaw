---
name: project_11616_forceinline_debugnoscope_caller_scope
description: "#11616 ForceInline return emits DebugNoScope instead of restoring caller DebugScope. Draft PR #11617 (bot, fix/issue-11616) OPEN/draft, awaiting csyonghe/kaizhangNV review; assignee pdeayton-nv. Holds root cause, the settled NOSCOPE-NOT test ruling, the slang-test -O override trap, merge-not-rebase rule, and the narrowed #11265 workflow-push claim. Distilled 2026-10-04."
metadata:
  node_type: memory
  type: project
  tags:
    - slang
    - spirv
    - debug-info
    - inlining
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# slang#11616 — `[ForceInline]` return emits `DebugNoScope` instead of restoring the caller's scope

Canonical thread `gh-issue-shader-slang/slang-11616`. This chain went dark for 7 weeks because its
state lived only in a dead conversation and its triage memo had **no index row** — the index row,
not the memo, is the tripwire.

## State (live read 2026-10-04)

**PR #11617** — OPEN, **draft**, head `4bd18cba1e`, last updated 2026-08-25. RESUME =
csyonghe/kaizhangNV review → maintainer merge. Nothing merged.

| role | who |
|---|---|
| requester | pdeayton-nv (issue cmt `5175145553`, asked for the master update; answered in `5176451177`) |
| reviewers | csyonghe, kaizhangNV (unchanged; kaizhangNV is still a reviewer) |
| assignee | pdeayton-nv since 2026-08-04 21:10Z (jkwak-work reassigned off kaizhangNV, cmt `5184666779`) — not a go-ahead on the change |
| affected-test author | jkwak-work (#12253 added the `NOSCOPE` assertions being changed) |

Resolve these from the live API at use time, never from a relay — I carried pdeayton over from
adjacent #12148 and got it wrong twice ([[feedback_control_the_instrument_not_the_reasoning]]).

## The defect

At `-O0 -g3 -target spirv-asm`, caller-local `DebugValue` after a `[ForceInline]` return lands under
`DebugNoScope`. `emitCalleeDebugInlinedAt` (`slang-ir-inline.cpp:336-370`) scans backward for an
enclosing `IRDebugScope`, stops at the first `IRDebugNoScope`, and otherwise emits `DebugNoScope`
(`:369`). A function's own entry `DebugScope` is **not materialized in IR** — it is synthesized at
emit (`slang-emit-spirv.cpp:4264/4296/4305`) — so a top-level caller gives the scan nothing to find.
User-visible symptom (maxime-modulopi `4868054234`, unanswered for 7 weeks): RenderDoc does not
crash, it **loses position** and jumps around after leaving `getDescriptorFromHandle`. Mechanism +
fix layers: `/workspace/shared/learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md`.

## Test-contract ruling (settled): bare `NOSCOPE-NOT`, no re-pinned count

`forceinline-multiple-cases.slang`'s `NOSCOPE-COUNT-14: DebugNoScope` **pins the bug** (fixed tree
emits 0) → replace with `NOSCOPE-NOT: %{{[0-9]+}} = OpExtInst %void %{{[0-9]+}} DebugNoScope`.

- Grounds come from #12253's **diff** (`ea711ddcb`): it added `-O0` to both `//TEST:` lines in the
  same commit as the `NOSCOPE` block — the `-O0` pin *is* its optimization-robustness mechanism.
- Don't pin a count on restores: master's `DebugNoScope` is 14/16/12/12 across `-O0..-O3`, while
  restores hold at 9 everywhere.
- Completeness evidence for the PR body: master 14 `DebugNoScope` + 9 restores, fixed 0 + 23 — a
  one-for-one replacement forced by the single `emitDebugNoScope` site in the exclusive if/else at
  `:353-370`.
- ⚠️ **`slang-test -O1 <file>` cannot override a directive's own `-O0`**:
  `tools/slang-test/slang-test-optimization-options.h` `addDefaultSlangOptimization` (`:80`) injects
  the default only when the directive names no level. Four "different" runs compiled identically —
  the fixer reported that as verification; it was vacuous.
- ⚠️ Anchor on `OpExtInst %void %{{[0-9]+}} DebugNoScope`, never bare `grep -c DebugNoScope` — `-g3`
  embeds the source, so the test's own comments match (16 raw vs 14 emitted). LLVM FileCheck does run
  locally (proved with a broken-CHECK control).

## Updating from master: merge, never rebase+force-push

Fleet rule, jhelferty-nv `5145911960` (2026-07-31): merge `origin/master` into the branch — a rebase
rewrites every SHA, reviewers lose the incremental diff and live approvals are dismissed. Done here as
two-parent bot merge `408eab4560` (local push, `unsigned`, not `web-flow`), same precedent as #12148's
`72be35c1a`. Codex flagged it 14× as must-fix; I ruled the merge stands —
[[feedback_gate_remedy_may_be_disjunctive_reread_it]].

## The #11265 workflow-push claim — narrowed, not refuted

The merge's **inherited** diff carried 72 `.github/workflows` paths into the PR, and the push was
accepted. That shows only that a bot **merge commit** can bring workflow paths in via ancestry. The
branch-head commit `08181a69b4` was single-parent with a 2-file, zero-workflow diff.
**#11265 stands for direct pushes and force-pushed rebases** — [[project_bot_workflows_permission]].
`pulls/N/files` (cumulative) and `commits/<sha>` (one commit) answer different questions; I read the
first as the second, then left a second cumulative figure (`10 files/+296/−22`) on the SHA in the very
sentence I was correcting. When you retract an instrument error, re-audit **every** number in that
sentence that came from the same instrument.

## Lessons from this chain

- **Re-read a thread before posting; a recorded "edit cmt N" is stale state.** Both stores said
  refresh our verdict `4865870445` in place, but a human had posted after it (`4868054234`); the
  correct post was fresh `5176412391`. Edit-in-place applies only while our bot is the last poster
  ([[feedback_github_comment_hygiene]]).
- **A live-artifact read carries a timestamp.** I nearly dispatched a body rewrite from an 08:16Z read
  of a PR body the fixer edited at 08:24Z — [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]].
- **Never describe an artifact you haven't created.** The fixer's report named a `/tmp` draft that
  never existed; a report naming a file is a claim it exists.
- codex-critique via MCP: `developer-instructions` must be a **top-level** arg to
  `mcp__codex__codex`, not nested under `config` (a round was rejected for this).

Related: [[project_11983_spirv_debugfunction_wrong_cu]] (#12148, merged prerequisite),
[[feedback_green_job_skipped_backend_zero_coverage]] (`filecheck=` / `slang-llvm` coverage).
