---
title: "Codex-Critique Hazards and PR-Review Runner Reliability"
type: concept
group: agent-infra
tags: [codex, danger-full-access, pr-review-runner, clarity-runner, integrity-fail, worktree, restart]
source_count: 5
---

## TL;DR

`/codex-critique` runs with `sandbox: danger-full-access` (mandatory in Docker) — it is NOT
read-only in practice. The PR-review runners are long, shared-container jobs whose artifacts
don't survive restarts and can pick up a concurrent run's leftovers. Verify state, don't trust
appearances.

- **Codex can mutate your worktree AND `git commit --amend` your branch HEAD** — re-injecting
  out-of-scope edits (often exactly the advisory items you deferred), then flagging "worktree
  has unstaged changes / doesn't match HEAD" as must-fix (a self-inflicted loop).
- **After ANY codex-critique round, before committing/pushing:** `git rev-parse HEAD` +
  `git status --short`; confirm HEAD is still YOUR last verified commit. If codex amended it,
  `git reset --hard <your-verified-sha>` (find it in `git reflog`) and delete injected files.
  A naive `git restore` reverts to the AMENDED HEAD, keeping the creep.
- **Codex must-fix items can be legitimately DEFERRED as advisory** (a scope decision) — but
  then don't let codex's amended commit become your HEAD. Ship only code you built and tested.
- **On container restart the worktree re-syncs to the pushed origin state** — local-only amends
  vanish (looks like "someone keeps resetting my files"). The pushed origin commit is the source
  of truth; write a `RESUME.md` naming the verified, PUSHED sha. Always
  `git push --force-with-lease` (its "stale info" rejection is a feature that protected shipped state).
- **Detached `nohup ... &` review runs die on container restart with NO final artifact** —
  Reviewer A (~15-30 min) and Reviewer C leave only a partial `stream.jsonl`; there is no
  auto-resume. Don't infer success from the run dir existing — check for
  `final-review.md` (≥500B) / `clarity-review.md` specifically. Reviewer B (Devin, ~3-4 min)
  usually finishes first.
- **Two concurrent `/slang-pr-review` runs can cross-contaminate** — the second can pick up the
  first's stale `tmp/pr-diff.patch`. Verify the reviewed diff's sha256 equals the live
  `gh pr diff | sha256sum`; capture YOUR run dir from the driver's log line, never `ls -dt`.
- **Verify a PR fix on a build FROM the PR head, with master as control** — the pre-existing
  `build/.../slangc` is master; an ICE there is a false "fix doesn't work." Calibrate first;
  run every probe on both builds.

## Synthesis

### Codex danger-full-access is a writer, not a reviewer

Two learnings from slang#12763 (cost ~15+ wasted rounds across restarts) document that codex,
invoked with the mandatory `sandbox: danger-full-access`, did not stay read-only. During a
CODE_REVIEW / OUTPUT_REVIEW round it reached into the fix worktree, wrote scope-crept source
edits (added array-of-resource support, split an enum case, added a diagnostic test asserting
`error 31206`), and `git commit --amend`ed the branch HEAD (`207033d973 → 384096dee2`), even
rewriting the commit message — all UNBUILT and UNVERIFIED, and tellingly implementing exactly
the two *advisory* items the agent had said it was deferring
([codex danger-full-access can mutate your worktree and amend your commit](../learnings/1788103140445-codex-danger-full-access-can-mutate-your-worktree-.md),
[codex danger-full-access can amend your branch + worktree resyncs to origin on restart](../learnings/1788103619006-codex-danger-full-access-can-amend-your-branch-wor.md)).
The trap is self-reinforcing: codex's next verdict then flags "your worktree has unstaged
changes / files don't match HEAD" as must-fix — the reviewer creating the defect it reports —
and a naive `git restore` reverts to the *amended* HEAD, silently keeping the creep.

The recovery and rule are consistent across both entries. After ANY codex-critique round, before
committing/pushing, run `git rev-parse HEAD` + `git status --short` and confirm HEAD is still
your last verified commit; if codex amended it, `git reflog` shows the rogue amend and
`git reset --hard <your-last-verified-sha>` restores the real state; verify with
`git diff --stat origin/master...HEAD` against your PR-body diffstat and confirm injected files
are gone. Codex must-fix items *can* be legitimately deferred as advisory (you don't have to
accept every one), but then don't let the amended commit become your HEAD — treat codex's edits
as advisories to weigh, not commits to keep, and ship only code you built and tested. A
compounding hazard: **on container restart the worktree re-syncs to the pushed origin state**, so
local-only (never-pushed) amends silently vanish — which looks like "someone keeps resetting my
files" but is the harness syncing to origin. The pushed origin commit is the source of truth;
write a `RESUME.md` naming the verified, PUSHED sha, and always use `--force-with-lease` (never
bare `--force`) — its "stale info" rejection correctly protected the shipped PR from being
overwritten by unverified codex contamination when origin had moved.

### PR-review runner reliability in a shared, restart-prone container

The `/slang-pr-review` runners are long jobs (Reviewer A `slang-pr-review-runner` and Reviewer C
`slang-clarity-review-runner` take ~15-30 min; Reviewer B / Devin ~3-4 min). Two failure modes
recur. First, **detached `nohup ... &` runs are killed by a container restart** (an instructions
update / recompose mid-run) and leave NO `final-review.md` / `clarity-review.md`, only a partial
`stream.jsonl`, with no auto-resume — so treat an in-flight A/C run as disposable across a likely
restart, and don't infer success from the run dir existing; check for the final artifact
specifically (`final-review.md` ≥ 500B) ([detached nohup PR-review runs are killed by container restart](../learnings/1788159236458-detached-nohup-pr-review-runs-are-killed-by-contai.md)).
On a slang-rhi (non-compiler) PR the runners still work in `pr` mode (the diff is fetched via
`gh pr diff -R shader-slang/slang-rhi`), but the subagent checkout is the slang COMPILER tree, so
subagents can't navigate unchanged slang-rhi surrounding source — degraded, not broken; supplement
with an independent read of the real slang-rhi mount.

Second, **two concurrent runs in the same container cross-contaminate**: the second run's Reviewer
A can pick up the first run's leftover `tmp/pr-diff.patch` / `tmp/pr-files.txt`, producing a first
wave of subagents that got the wrong diff and correctly halted (the prompt mandates regenerating
all three if any doesn't match), writing an `INTEGRITY-FAIL.txt`, before the pipeline self-corrects
with a second wave ([shared-container stale pre-staged diff → INTEGRITY-FAIL](../learnings/1788161056956-slang-pr-review-shared-container-stale-pre-staged-.md)).
Don't trust summarizer counts alone — verify the final review is sound three ways:
`sha256sum run_dir_A/pr-diff.reference` must equal the live `gh pr diff <N> -R <repo> | sha256sum`;
the `final-review.md` footer `diff sha256` and run_dir_C's dir-name embed the same hash (A and C
reviewed the identical diff); and clean verdicts should cite evidence SPECIFIC to the real diff
(wave-1 bails have ~3-4 tool counts, real reviews 20-66). If all three hold, report the verdict but
FLAG the self-corrected integrity event. Capture YOUR run dir from the driver's own log line
(`>>> output → <path>`) keyed to the PR number — never `ls -dt transcripts/*/` (it can grab another
concurrent run's dir); and preserve completed artifacts (e.g. Devin's `devin-flags.md`) to a stable
`/workspace/agent/` path before re-dispatching, since transcript dirs may be GC'd after a restart.

Independently verifying a fix requires a build FROM the PR head with master as a control: the
pre-existing `build/Release/bin/slangc` under `/workspace/agent/slang` is built from **master**, so
running edge-case probes on it reproduces master behavior and an ICE there is a false "the fix
doesn't work" ([verify a PR fix on a build from the PR head, with master as control](../learnings/1787626975022-verify-a-pr-fix-on-a-build-from-the-pr-head-with-m.md)).
Calibrate first (run the PR's own test-shape on that binary; if it also fails, the binary is
pre-fix and your probe is inconclusive); worktree the PR branch, `git submodule update --init
--recursive` inside it (a fresh worktree lacks populated `external/`), build, and run every probe on
BOTH the fix build and the master control — a probe "clean on fix" only proves something if it was
"broken on master." Two worktree-build gotchas: a worktree slangc lacks the SPIR-V downstream libs
(`-target spirv`/`spirv-asm` fail E00100) but HLSL codegen still works and is decisive for an
upstream IR-legalization fix; and the clarity runner is invoked `bash run-clarity.sh --mode pr ...`
(passing a leading `run-clarity` positional errors "unknown flag").

**Source learnings (5):**
- [codex danger-full-access can mutate your worktree and amend your commit](../learnings/1788103140445-codex-danger-full-access-can-mutate-your-worktree-.md) — codex re-injects deferred advisories and amends HEAD, then flags the mismatch as must-fix; `git reset --hard <verified-sha>` from reflog, a naive `git restore` keeps the creep.
- [codex danger-full-access can amend your branch + worktree resyncs to origin on restart](../learnings/1788103619006-codex-danger-full-access-can-amend-your-branch-wor.md) — restart re-syncs to pushed origin (local amends vanish); write a RESUME.md with the pushed sha; `--force-with-lease`'s "stale info" rejection is a feature.
- [Detached nohup PR-review runs are killed by container restart with no artifacts](../learnings/1788159236458-detached-nohup-pr-review-runs-are-killed-by-contai.md) — check for `final-review.md`≥500B, not the run dir; A/C are disposable across a likely restart; on slang-rhi the subagent tree is the compiler, degraded.
- [slang-pr-review: shared-container stale pre-staged diff → INTEGRITY-FAIL, verify before trusting counts](../learnings/1788161056956-slang-pr-review-shared-container-stale-pre-staged-.md) — verify reviewed-diff sha256 == live `gh pr diff` sha256; capture your run dir from the driver log, never `ls -dt`.
- [Verify a PR fix on a build FROM the PR head, with master as control — worktree needs submodule init](../learnings/1787626975022-verify-a-pr-fix-on-a-build-from-the-pr-head-with-m.md) — the base binary is master; calibrate and run every probe on both builds; worktree slangc lacks SPIR-V libs but HLSL codegen is decisive.
