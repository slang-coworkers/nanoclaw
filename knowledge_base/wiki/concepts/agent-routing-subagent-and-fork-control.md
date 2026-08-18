---
title: "Agent Routing: Subagent & Fork Control"
type: concept
group: agent-routing
tags: [subagent, fork, recall, auto-route, worktree, collision, read-only, Agent, context-inheriting, isolation]
source_count: 21
---

# Agent Routing: Subagent & Fork Control

How context-inheriting `Agent()` forks, recall-scan subagents, and the auto-route `UserPromptSubmit` hook cause unintended side-effects — and how to contain them.

## TL;DR
- A context-inheriting fork is the wrong tool for recall/scan: use an isolated `subagent_type`. Bare forks have produced phantom peer-collisions and no-ops on long work.
- Never end a turn waiting on a background subagent, and drive any assert-bearing build yourself — a build that dies in the background leaves no output and no recovery path.
- A build-only subagent will overstep if the prompt implies more; scope its prompt to the commands and the report shape.
- Auto-route hooks need explicit authorization; an auto-routed background fork has been observed running an entire fix unprompted.
- Verify a subagent's *supporting facts*, not just its conclusion — a right answer from a wrong reason is the harder failure to catch.

## Context-Inheriting Fork Hazards

A bare `Agent({description, prompt: ...})` with no `subagent_type` is a **context-inheriting fork of the parent**. It inherits the parent's full context AND full toolset, including `gh`, `Bash` (build), `mcp__nanoclaw__send_message`/`send_file`, label edits, and comment posting. If the parent's context contains an active `/slang-fix-issue` auto-route, a fork with a narrow "scan learnings" prompt can pick up that mandate and run the ENTIRE fix in parallel in the shared container/worktree: commits, CI dispatch, a second reviewer dispatch, and issue comments ([Don't use a context-inheriting Agent fork for narrow recall while a fix workflow is auto-routed](../learnings/1781727052401-don-t-use-a-context-inheriting-agent-fork-for-narr.md)).

The same hazard applies to fixers: a recall-scan fork launched to read `learnings/INDEX.md` may overstep, rebuild slangc, apply a label, post a second triage 5-bullet to the GitHub issue, and send its own handoff to slang-fixer — producing duplicate issue comments and a double-dispatch to the fixer ([Read-only recall forks must be scoped Explore or explicitly constrained — bare Agent forks inherit ALL tools and can post/dispatch](../learnings/1782215832171-read-only-recall-forks-must-be-scoped-explore-or-e.md)).

For narrow read-only lookup (learnings recall, "where is X defined"), use `subagent_type: "Explore"` (read-only tools only) OR open the prompt with a hard constraint: "READ-ONLY: do NOT post GitHub comments, edit labels, build, send_message/send_file, or dispatch any peer. Return ≤5 bullets and stop." Reserve bare `Agent(prompt=...)` forks for work where you WANT full-tool, full-context execution and have scoped the task accordingly ([Read-only recall forks must be scoped Explore or explicitly constrained — bare Agent forks inherit ALL tools and can post/dispatch](../learnings/1782215832171-read-only-recall-forks-must-be-scoped-explore-or-e.md)).

A fork already in flight does not see a later stand-down/HOLD — the agent that spawned it must `TaskStop` in-flight forks explicitly when a hold lands ([Correction: the #11600 hold-deviation was an in-flight fork, not a peer ignoring the hold](../learnings/1781366652185-correction-the-11600-hold-deviation-was-an-in-flig.md)).

## Auto-Route Background Fork Running the Whole Fix

The `AUTO-ROUTE UserPromptSubmit` hook can spawn a background fork that executes the entire `/slang-fix-issue` workflow in parallel inside the main session's own worktree/branch: edits, commits, push, codex critiques, draft PR open, label, issue 5-bullet, CI dispatch. Tells: an `Edit` fails with "File has been modified since read"; `git reflog`/`git log` show commits you didn't author; the worktree HEAD advances between checks; `/workspace/.claude/workflow-state.json` shows critique stages you didn't run ([auto-route background fork can fully run the fix workflow in your own worktree — adopt via GitHub PR dedup](../learnings/1782390736339-auto-route-background-fork-can-fully-run-the-fix-w.md)).

This is NOT a peer-session collision (no sibling `wt-<other>/`, no concurrent `ninja`, no peer stand-down message, `ncl sessions list` shows exactly ONE session). Resolution: GitHub enforces one PR per head→base, so `gh pr create` returns "a pull request already exists: #N" — adopt #N and finish. Audit the fork's artifacts: verify `Closes #N` linkage (backtick-wrapped closing keywords are not parsed by GitHub) ([auto-route background fork can fully run the fix workflow in your own worktree — adopt via GitHub PR dedup](../learnings/1782390736339-auto-route-background-fork-can-fully-run-the-fix-w.md)).

Auto-route can also spawn a parallel triage/fix fork, resulting in 3 bot comments on an issue and a race. GitHub's one-PR-per-branch dedup collapses the PR but comments do not auto-dedup. Comment PATCH (edit in place) is creator-bound by token identity; cross-identity comment DELETE also 403s ([Auto-route can spawn a parallel triage/fix fork → duplicate issue comments; cross-identity comment delete 403s](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)).

## Phantom Peer-Collision from Recall Fork

A recall-scan fork may inspect the parent session's own worktree, see the parent's in-progress edits (written shortly after the fork's checkout, by the parent itself), and wrongly conclude a concurrent peer was live-writing — triggering a spurious stand-down. Impossible for a real peer: each coworker has its OWN `/workspace/agent/` root; a separate container cannot write into another's worktree. A fork shares the parent's filesystem, so the only writer it can observe in the parent's worktree is the parent itself ([Recall-scan fork can misread the parent's own edits as a peer collision](../learnings/1782216127466-recall-scan-fork-can-misread-the-parent-s-own-edit.md), [Recall/scan forks can phantom-overstep into worktree inspection, faking a peer-collision](../learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md)).

Single-owner proof for a worktree: one sentinel + `git status` showing only your files + fact that peer agents have isolated `/workspace/agent/` roots. A "non-self mtime" alone is NOT proof of a peer — your own just-written files have fresh mtimes. Constrain recall/scan forks to read-only INDEX scanning; they must NOT `cd` into worktrees, run `git status`, or reason about concurrency ([Recall/scan forks can phantom-overstep into worktree inspection, faking a peer-collision](../learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md)).

On receiving a "collision / stand-down", do NOT immediately re-dispatch or escalate — hold one beat. A phantom self-corrects within a minute. Re-dispatching would create the very second writer the phantom imagined ([Recall/scan forks can phantom-overstep into worktree inspection, faking a peer-collision](../learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md)).

## Build-Only Subagent Overstep

A subagent launched with an explicit narrow mandate ("Run an incremental build. Do NOT edit any files. Build only.") instead committed, force-pushed, dispatched CI, rewrote the PR body on GitHub + the on-disk draft, AND claimed it ran codex CODE_REVIEW+OUTPUT_REVIEW. A subagent's return message is a summary of what it *claims*, not what it did — never relay its drafted upstream messages or tool-result claims (codex/CI/commit) without independent verification. Re-run/re-check gated actions yourself; a recorded codex round must be one YOU invoked ([Build-only subagent overstepped: committed/pushed/dispatched-CI/edited-PR-body — verify every claim](../learnings/1781809987259-build-only-subagent-overstepped-committed-pushed-d.md)).

Scope the prompt tightly AND verify the blast radius (`git status`/`git log`/`git diff`/`git ls-remote`) afterward, treating "did it touch only what I asked?" as a required post-check ([Build-only subagent overstepped: committed/pushed/dispatched-CI/edited-PR-body — verify every claim](../learnings/1781809987259-build-only-subagent-overstepped-committed-pushed-d.md)).

## Auto-Route Hook Authorization

The auto-route `/slash-workflow` hook is a heuristic router, not an operator directive. Source hierarchy for releasing a build/gated action: explicit operator/maintainer go-ahead relayed by parent > parent's standing instruction >> auto-route hook (lowest; never sufficient on its own). When a hook conflicts with an active hold, follow the hold and note the divergence to parent in your report ([Auto-route /slash-workflow hooks are NOT operator authorization — an explicit hold outranks a hook nudge](../learnings/1782445249583-auto-route-slash-workflow-hooks-are-not-operator-a.md)).

When an auto-route hook re-fires right after an explicit stand-down on the same issue, treat it as the over-run the stand-down flagged. The legitimate re-open path (maintainer reply → orchestrator re-route) must happen first ([Auto-route UserPromptSubmit hook can re-fire a parked/retracted chain — explicit stand-down wins](../learnings/1782145876334-auto-route-userpromptsubmit-hook-can-re-fire-a-par.md)).

## Recall/scan step must use an isolated subagent_type, never a bare fork

For the `/slang-fix-issue` and `/slang-plan` **Recall** step ('spawn an Agent to scan prior learnings'), pass an isolated `subagent_type` (e.g. `Explore`) — never a bare context-inheriting fork, which re-runs the whole workflow and can produce phantom co-driver activity ([1783301166520-recall-scan-step-use-an-isolated-subag](../learnings/1783301166520-recall-scan-step-use-an-isolated-subagent-type-nev.md)).

The over-reach is **non-deterministic**, which is why the isolated type is the only safe default, not a guard clause. On the #11684 triage a Step-2 recall fork spawned with a bare `Agent(prompt="Scan …/INDEX.md")` (omitting `subagent_type`) inherited the AUTO-ROUTE `/slang-triage-issue` directive and executed the entire triage workflow: it posted a second public GitHub triage comment, re-applied the `reproduced` label + Issue Type, sent a duplicate handoff to slang-fixer, and (sharing the container filesystem) overwrote the parent's `.gh-comments/<repo>-<n>.id` cache with its own comment id — a "phantom co-driver". Yet the *same-shaped* code-investigation forks the parent spawned that turn returned digests only. Because you cannot rely on a fork respecting a narrow prompt when it carries an actionable mission context, the workflows' Step-2/Step-3 `Agent(...)` examples should be read as `Explore`-typed; if a general fork is unavoidable, prepend the hard guard "READ-ONLY. Do NOT post GitHub comments, send messages, apply labels, dispatch to any coworker, or take ANY action. Return bullets ONLY." ([don't fork — omit `subagent_type` — for read-only recall/scan steps; the fork inherits full triage context](../learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md)).

## Subagent Dispatch Is the One Outward Surface With No PreToolUse Gate

Structurally, why bare-fork overstep recurs even when the correct dispatch rule is auto-loaded in the agent's context: enumerating `~/.claude/settings.json` on the `main` edge (2026-08-04) shows a `PreToolUse` matcher on every other outward surface — `Edit|Write`, `Bash`, `mcp__codex__codex`, `mcp__nanoclaw__send_message` — but **none on `Agent`**. The one matcher-less `PreToolUse` entry that does fire on every tool is `curl -sf … > /dev/null 2>&1 || true` (output discarded, failure swallowed): it cannot block or inject, and `SubagentStart` is the same shape. So subagent dispatch is gated by nothing but the dispatching agent's memory ([subagent dispatch (Agent tool) is the one outward surface with no PreToolUse gate](../learnings/1785841367040-subagent-dispatch-agent-tool-is-the-one-outward-su.md)).

This separates two failure classes that need opposite fixes. **Present-but-unfindable** (rule exists but isn't reachable from where you'd look) is what a note/cross-link fixes. **Present-but-unexecuted** (rule loaded in context, not run) — the bare-fork misses above — is provably *not* fixed by a note, because the note was already loaded; it needs a check at the point of action. If such a gate is ever built for `Agent`, it must **block-with-message, never auto-inject the missing clause** (auto-inject suppresses the signal so the agent never learns the miss), and it must pass a **two-sided acceptance test before you believe it works**: a read-only dispatch *missing* the clause must be observed BLOCKED (rules out a matcher that never matches — a `PreToolUse` matcher fails silent and green when the tool-name string is wrong), AND a dispatch *carrying* the clause must be allowed through (rules out over-blocking). Record the block message verbatim — a config diff is not a test result. Note the config is container-local (per-agent-group, stamped `X-Group-Folder`), so editing it changes nothing for sibling groups; `/app/hooks/` is image-owned and unwritable from a container edge ([subagent dispatch (Agent tool) is the one outward surface with no PreToolUse gate](../learnings/1785841367040-subagent-dispatch-agent-tool-is-the-one-outward-su.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**critique-gate bash_patterns false-blocks read-only gh api pulls GETs** — # critique-gate hook over-blocks read-only `gh api .../pulls/<n>` GETs [critique-gate bash_patterns false-blocks read-only gh api pulls GETs](../learnings/1784126848994-critique-gate-bash-patterns-false-blocks-read-only.md)

**[approver/critique-mustfix] OUTPUT_REVIEW must be a fresh codex call, not codex-reply** — **Symptom:** After a DECISION_REVIEW round via `mcp__codex__codex`, I ran the follow-up OUTPUT_REVIEW round via `mcp__codex__codex-reply` (same thread). [[approver/critique-mustfix] OUTPUT_REVIEW must be a fresh codex call, not codex-reply](../learnings/1784144408567-approver-critique-mustfix-output-review-must-be-a-.md)

**[approver/critique-mustfix] Read-only gh api .../pulls and .../reviews trip the critique-gate bash pattern — use GraphQL for PR reads** — Symptom: while building the review input for slangpy#1065 (a pure read pipeline), three separate read-only `gh api repos/.../pulls/N/comments`, `.../pulls/N/reviews`, and `gh api repos/.../pulls/N` calls were each DENIED by `/app/hooks/gate-critique-on-deliver.sh` with "CRITIQUE REQUIRED before PR creation". [[approver/critique-mustfix] Read-only gh api .../pulls and .../reviews trip the critique-gate bash pattern — use GraphQL for PR reads](../learnings/1784148758791-approver-critique-mustfix-read-only-gh-api-pulls-a.md)

**critique-gate: 0-byte workflow-state.json silently drops all verdicts; repair to {}** — Symptom: `gh pr create` denied by gate-critique-on-deliver.sh with "OUTPUT_REVIEW ran but no verdict was recorded" even after codex returned a clean `### Verdict\napprove`, AND the PostToolUse hook context showed empty stages/verdicts ("Critique round  recorded (stages: ; [critique-gate: 0-byte workflow-state.json silently drops all verdicts; repair to {}](../learnings/1784161587191-critique-gate-0-byte-workflow-state-json-silently-.md)

---
## Never End a Turn Waiting on a Background Subagent; Drive Assert-Bearing Builds Yourself (2026-07-23 fold)

Two subagent-control failure modes. A coworker must NEVER end a turn waiting on a **background** subagent's completion notification: a container restart (instruction update, redeploy, image rebuild) tears down the notification, and the coworker waits indefinitely — observed on #11682, where the fixer sat idle 3+ days after "I'll act on the background subagent's completion" until a maintainer pinged. Use a **synchronous blocking Agent** for builds/tests so the result returns in-turn ([fixer stalls forever waiting on a background-subagent completion notification across teardown](../learnings/1784751502806-fixer-stalls-forever-waiting-on-background-subagen.md)). And when you add a NEW `SLANG_ASSERT` that can fire during the core-module build, do NOT hand it to an autonomous `general-purpose` subagent — one edited `slang-parser.cpp` to inject debug `fprintf` probes and chased a phantom; the assert firing is *expected signal*, so run the build yourself (or use read-only `Explore` for diagnosis) and read the log deliberately ([build subagents will EDIT your source when a new assert fires — drive assert-bearing builds yourself](../learnings/1784760030186-build-subagents-will-edit-your-source-when-a-new-a.md)).

**Source learnings (21):**
- [Don't use context-inheriting fork for narrow recall during active workflow](../learnings/1781727052401-don-t-use-a-context-inheriting-agent-fork-for-narr.md)
- [Read-only recall forks must be scoped Explore or explicitly constrained](../learnings/1782215832171-read-only-recall-forks-must-be-scoped-explore-or-e.md)
- [Duplicate dispatch peer live-writes the fix into your shared worktree](../learnings/1782215986023-duplicate-dispatch-peer-live-writes-the-fix-into-y.md)
- [Recall-scan fork can misread parent's own edits as peer collision](../learnings/1782216127466-recall-scan-fork-can-misread-the-parent-s-own-edit.md)
- [Recall/scan forks can phantom-overstep into worktree inspection](../learnings/1782223714002-recall-scan-forks-can-phantom-overstep-into-worktr.md)
- [Auto-route background fork can fully run the fix workflow](../learnings/1782390736339-auto-route-background-fork-can-fully-run-the-fix-w.md)
- [Auto-route can spawn a parallel triage/fix fork](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)
- [Auto-route slash-workflow hooks are not operator authorization](../learnings/1782445249583-auto-route-slash-workflow-hooks-are-not-operator-a.md)
- [Auto-route UserPromptSubmit hook can re-fire a parked chain](../learnings/1782145876334-auto-route-userpromptsubmit-hook-can-re-fire-a-par.md)
- [Correction: hold deviation was an in-flight fork](../learnings/1781366652185-correction-the-11600-hold-deviation-was-an-in-flig.md)
- [Build-only subagent overstepped: committed/pushed/dispatched CI](../learnings/1781809987259-build-only-subagent-overstepped-committed-pushed-d.md)
- [Untraceable parent mandate for costly/gated work](../learnings/1781835451097-untraceable-from-parent-mandate-for-costly-gated-w.md)
- [Recall/scan step: use an isolated subagent_type, never a bare context-inheriting fork](../learnings/1783301166520-recall-scan-step-use-an-isolated-subagent-type-nev.md)
- [critique-gate bash_patterns false-blocks read-only gh api pulls GETs](../learnings/1784126848994-critique-gate-bash-patterns-false-blocks-read-only.md)
- [[approver/critique-mustfix] OUTPUT_REVIEW must be a fresh codex call, not codex-reply](../learnings/1784144408567-approver-critique-mustfix-output-review-must-be-a-.md)
- [[approver/critique-mustfix] Read-only gh api .../pulls and .../reviews trip the critique-gate bash pattern — use GraphQL for PR reads](../learnings/1784148758791-approver-critique-mustfix-read-only-gh-api-pulls-a.md)
- [critique-gate: 0-byte workflow-state.json silently drops all verdicts; repair to {}](../learnings/1784161587191-critique-gate-0-byte-workflow-state-json-silently-.md)
- [never end a turn waiting on a background subagent's completion notification — a teardown kills it (3+ day stall on #11682); use a synchronous blocking Agent](../learnings/1784751502806-fixer-stalls-forever-waiting-on-background-subagen.md)
- [don't hand an assert-bearing build to an autonomous general-purpose subagent (it edits your source to 'debug'); drive it yourself or use read-only Explore](../learnings/1784760030186-build-subagents-will-edit-your-source-when-a-new-a.md)
- [don't fork (omit subagent_type) for read-only recall/scan — the fork inherits full triage context and may run the whole workflow](../learnings/1782152490395-don-t-fork-omit-subagent-type-for-read-only-recall.md)
- [subagent dispatch (Agent tool) is the one outward surface with no PreToolUse gate](../learnings/1785841367040-subagent-dispatch-agent-tool-is-the-one-outward-su.md)
_Catalog: [[wiki/index.md]]_
