---
type: project
name: project_13876_non_overloadable_same_scope_redeclaration
description: "slang#13876 (skiminki-nv, MEMBER, self-assigned, sub-issue of #13719): no redeclaration diagnostic for a global `static const` vs an [UnscopedEnum] case / cbuffer / tbuffer member. Assignee-authorized bot PR #13880 (fixer sgt9at), READY @ae2249915, pr: non-breaking: W30204 in EVERY version (incl. 202c, per assignee 10-27 14:57Z) for conflicts master accepts, master's E30200 unchanged, W30203 all versions. 10-28 11:36Z skiminki-nv REQUEST_CHANGES (6 asks: type-based buffer pairing, per-container pass, parser alias marker, process report, shorter comments, five-part description) → 10-28 13:46Z reworked @69255c6c3 (1–5 done; 6 short-form within the gate, full report in explanation comment), 10-28 15:48Z skiminki-nv APPROVED + merge-queued 15:51Z, unqueued 16:14Z for a message reword (applied @ae2249915), which DISMISSED the approval; 16:31Z RE-APPROVED 'LGTM if CI passes' @ae2249915; 18:52Z CI GREEN (pull_request 40725494846, rollup SUCCESS); awaiting skiminki-nv re-queue; gate question moot; OPERATOR decision pending on 3 pre-existing bugs; one-shot rechase-13876-pr-13880-c876 10-29 12:00Z. Dated log in _history."
---

# slang#13876: diagnose non-overloadable declarations in the same scope

Dated log (ids, heads, CI runs, every forward): [[project_13876_non_overloadable_same_scope_redeclaration_history]].
Umbrella: [[project_13719_unqualified_name_lookup_umbrella]].

## Current state (as of 10-28 18:55Z, checked live)

| | |
|---|---|
| PR | [#13880](https://github.com/shader-slang/slang/pull/13880) `fix/issue-13876` @ `ae2249915`, ready (marked by skiminki-nv 10-23 13:24Z), `pr: non-breaking`, 21 files, 34 commits |
| Owner | slang-fixer `sess-1792694206953-sgt9at` (PR-mapped) on `gh-issue-shader-slang/slang-13876`; triager `sess-1792693495093-68uevm` (holds its own re-check `t-29e011`) |
| Review | skiminki-nv APPROVED 15:48Z ([5685541303](https://github.com/shader-slang/slang/pull/13880#pullrequestreview-5685541303)) and merge-queued 15:51Z; unqueued 16:14Z for the W30204 reword; the reword push **dismissed the approval** (16:23Z); reviewDecision null, BEHIND |
| CI | pull_request run 40725494846 **success**; PR rollup SUCCESS (the yielded dispatch 40725539917 rows are hidden by the rollup) |
| Parked on | skiminki-nv re-queuing (re-approved 16:31Z [5686166855](https://github.com/shader-slang/slang/pull/13880#pullrequestreview-5686166855), "LGTM if CI passes"; condition met); BLOCKED is the normal pre-queue state; no bot pushes, dispatches or notes |
| Timer | one-shot `rechase-13876-pr-13880-c876`, 10-29 12:00Z |
| Operator | decision pending: file the 3 pre-existing bugs below? |

## The bug and its two root causes (triage memo `/workspace/agent/reports/triage/triage-13876.md`)

1. **Order dependence.** `[UnscopedEnum]` cases become untyped `static const` LetDecls in the
   enclosing scope (`slang-parser.cpp:6123`). An inferred-type var jumps straight to
   DefinitionChecked, so `ensureDecl` skips the ReadyForReference redeclaration visitor, and the check
   only looks backwards. `static const` *after* the enum already errored.
2. **cbuffer/tbuffer members** live in a synthesized `ParameterGroup_*` struct behind a
   `__transparent` var (`parser.cpp:4402`); `checkForRedeclaration` (`slang-check-decl.cpp:14880`)
   compares only direct members of one container.

Fix A + B: run the skipped visitor in `ensureDecl`, and compare transparent buffer members across the
enclosing scope. Coverage also includes untyped let/var, unsized arrays, `-unscoped-enum`, and GLSL
blocks without an instance name.

## Maintainer decisions (current one wins)

- **10-23 10:08Z** (PR comment 6362500485): cbuffer/tbuffer conflicts a hard error, follow DXC;
  `enum Mode { Mode, Other }` a warning in every version → **W30203** (still in force).
- **10-27 09:04Z, REVISED** (issue comment 6437822891): these conflicts are a **warning in
  2018–2026**; #13956 (skiminki-nv, filed 10-26) tracks 202c name lookup / overload resolution.
  Implemented as: conflicts master accepts → **W30204 before 202c, E30200 in 202c**; master's existing
  E30200 cases unchanged (e.g. `{ let a = 1; int a = 2; }`, enum-then-`static const`). Note
  `{ int a; let a = 1; }` is accepted by master, so it is now a warning.
- **10-27 14:57Z, ANSWERED** (issue comment 6445312525): (1) "Treat 202c the same as 2018–2026 for
  now. We'll deal with 202c later as part of #13956." (2) Errors that exist today: "Keep these as
  errors." ⇒ W30204 in every version incl. 202c; master's E30200 unchanged. Implemented @`c2fb1a394` 15:27Z.
- Known DXC divergence, raised in issue status 6351304001: `struct Light {}; cbuffer CB { Light Light; }`
  is diagnosed, where DXC accepts it.

## Pre-existing bugs found by the fixer, not filed (operator decision pending)

- `-no-mangle` with `cbuffer CB { float CB; }` segfaults.
- A Debug `foundParent` assert fires on a `__generic` cbuffer.
- `[[vk::push_constant]] static let` gets no E31219.

## Lessons from this chain

- **Routing a self-assigned MEMBER issue:** self-assignment alone is not a maintainer-owned plan. A
  bug-report body (repro / expected / actual, no fix direction or own PR) is routed to the triager,
  like the same author's #13720/#13750/#13752; only the umbrella and the design clean-up
  [[project_13819_namespace_container_cleanup]] were held. Rung 4 of
  [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]].
- **An issue comment from the assignee does not route through the PR mapping.** Forward their
  direction on the PR they asked for verbatim to the fixer, even without a bot mention; a comment that
  only tags another human (rung 5) is not a summons.
- **Read CI from `repos/<o>/<r>/commits/<sha>/check-runs`, filtered by run**, not `gh pr checks`
  (it omitted the failing priority-yield runs) and not a naive tally (a stale pre-ready run still
  showed "failure=2" on a green head).
- **On a non-draft PR, don't workflow_dispatch CI:** the bot dispatch priority-yields and leaves red `check-ci` rows on the
  head next to the real pull_request run, which muddies a reviewer's "LGTM if CI passes".
- **A push after approval dismisses it on shader-slang/slang** (stale-review dismissal), and the repo uses a
  merge queue that accepts a BEHIND branch. Once a PR is approved, push only on the reviewer's request, report the
  dismissal, and don't add a master merge, which would cost another re-approval.
- **Falcor red during an outage:** once the `slang-tests-*` artifact has expired, a test-falcor-only
  rerun fails in 19 s; re-run the build job. Here the red was the #13725 outage, and a fixer waiting
  for a rerun webhook that never fires needed a supervisor nudge.
