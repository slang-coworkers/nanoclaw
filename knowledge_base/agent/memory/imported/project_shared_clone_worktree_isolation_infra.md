---
name: project_shared_clone_worktree_isolation_infra
description: "INFRA escalation (not a Slang defect): N sessions share one /workspace/agent/<project> checkout under one bot identity; destructive git ops clobber co-tenant work (6 field instances in days). Worktree isolation MEASURED as a genuine fix. 4-item operator ask. STATE: AWAITING OPERATOR decision on the spine default; nothing implemented."
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1786037800083-onan60
---
# N sessions, one working tree — the infra escalation (measured, awaiting operator)

**Platform/infra, no shader-slang issue, no fixer.** Multiple sessions share one
`/workspace/agent/<project>` clone under one bot identity; destructive git ops in the shared checkout
destroy co-tenant work. Severity HIGH. Surfaced from
[[project_12404_slang_package_tool_maintainer_owned]].

**Six field instances in days** (not "twice"): (1) `reset --hard` destroyed 3 tracked files
(unrecoverable — never staged, stash empty); (2) a reset silently reverted an applied patch mid-build,
voiding 4 measurements (only tell: an empty `git diff` where a hunk was expected); (3) a watched file
went MODIFIED→byte-identical-to-HEAD mid-session with no actor; (4) a destructive hand-off read as
routine because N sessions share one identity (see
[[feedback_a_handoff_granting_destructive_authority_needs_the_same_audit_as_blame]]); (5) a `reset --hard`
destroyed a sibling's unstaged edit — **same coworker, different session** (recovery was luck); (6) a
`FETCH_HEAD` race materialized a worktree at the **wrong commit** — a valid tree, confidently wrong,
leaving no trace (caught only by a commit-binding assert).

## The remedy is `git worktree` — MEASURED as a genuine fix, not a mitigation

A/B (throwaway `git init` in `/tmp`, never the real clone): an identical co-tenant
`reset --hard <base> && git clean -fd(x)` in the MAIN checkout **destroys** the victim's tracked patch,
untracked file, and (with `-x`) a gitignored `build/` — while a victim working in a **`git worktree`
survives** all of it. `index`, `HEAD`, `FETCH_HEAD`, and the submodule object store are **per-worktree**,
so source loss, build loss (`clean -fdx` costs ~3.4 GB + ~20-min rebuild, and `git status --porcelain`
is structurally blind to it), and the `git add -A` cross-session staging leak are all isolated by a
worktree. The one class no worktree fixes: **attribution under a shared bot identity** — "which session
owns this edit" is unanswerable from the tree alone.

## Cost model (quote 4–9%) and why the obvious cheaper options are off the menu

| shape | per worktree | ×~59 | % of ~485G | builds? |
|---|---|---|---|---|
| submodule-less | 87 MB | 5.0 G | 1.0% | **NO** (dies at missing SPIRV-Headers target) |
| src+submodule files only | 284 MB | 16.4 G | 3.4% | yes |
| + private objects, LEAN | 334 MB | 19.2 G | **4.0%** | yes |
| + private objects, HEAVY | 750 MB | 43.2 G | **8.9%** | yes |
| per-worktree BUILD (rejected as default) | 6.3 G | 376.7 G | **78%** | — |

The lean/heavy 9× spread is un-gc'd loose objects, not inherent (whether `git gc` on a shared store with
live sessions is safe is UNTESTED — it is the destructive-op class under review). **A shared build dir is
IMPOSSIBLE:** CMake hard-binds `CMAKE_HOME_DIRECTORY`/`CMAKE_CACHEFILE_DIR` to its source path (33
absolute refs), so a worktree pointed at the main `build/` compiles the wrong sources. **The lever is the
compiler CACHE:** `SLANG_USE_SCCACHE` is real and in-tree, but `sccache`/`ccache` are not on PATH →
installing is `install_packages` ⇒ image rebuild ⇒ operator-level.

## Spine rules (needed for as long as one tree is shared) + the guard lesson

1. **Never bare `git stash pop`/`drop` in a shared clone** — `refs/stash` is one namespace; a bare pop
   materializes a co-tenant's entry in your tree. Use `stash push -m <session-tag>`, pop by
   message-matched index.
2. **Never conclude "dead worktree" or run `git worktree prune` from a foreign mount** — the `.git`
   gitdir is absolute, so `prunable`/`prune -n` falsely flag a healthy worktree.
3. **`git add -A` is unsafe in a shared checkout** (safe in a worktree — the index is per-worktree).
4. **A guard whose output nothing branches on is a log line, not a guard.** Instance #5's destructive
   command *contained* its check (`git status --porcelain | ... | wc -l` printed `1`) and ran anyway,
   because no control flow consumed it ⇒ `test "$MODS" -eq 0 || { echo ABORT; exit 1; }`, and prefer
   `merge --ff-only` over `reset --hard` (it *cannot* silently discard). ⭐ The failure mode is that **a
   destructive verb inside routine BOILERPLATE never reaches the deliberation the same verb gets when it
   IS the decision** — including in `ncl tasks` prompts, which are code (found + fixed one in our own
   nightly KB-sync task).

## Recommendation to the operator (the 4-item ask) + STATE

1. Default **write-capable** chains to a per-chain **source-only** worktree (~1%, field-proven 87 MB —
   but note submodule-less can't build; use src+submodules for build-capable chains).
2. Do **not** default a per-worktree build (78%); reclaim space by pruning `build/` subdirs, not removing
   worktrees.
3. **Install `sccache`** so opt-in builds share a cache instead of each paying ~6.3 G cold.
4. Fix the **guard-beside-the-action default in the coworker spines** — a one-line spine edit fixes every
   coworker at once (instance #5 was caused by this, not by isolation being absent).
Scale isolation to **WRITE capability, not session count** ("builds" counts as write-capable).

**STATE — AWAITING OPERATOR** decision on the spine default; **nothing implemented, no config changed**
(as of 08-10). The operator has been away, not rejecting: no inbound chat since 2026-08-06 19:40Z and
multiple `critique_gate_bypass` approval cards left unanswered. Peer-authored memo (51 lines) at
`/workspace/inbox/a2a-1786044423039-kijpb3/infra-shared-worktree-collision.md`. Driven by recurring
escalation task `infra-worktree-escalatio-8baa` (re-ping only on a NEW destruction instance).
Related: [[feedback_group_clone_is_shared_by_all_sibling_sessions]],
[[feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value]].

### Instrument traps found while measuring (condensed — several also in shared learnings)

`ncl sessions messages` truncates text to 300 chars → use `--full`. `ncl sessions list --limit 2000`
silently caps at 2000 rows → use `--limit 6000` + `--json` (column-position `awk` mis-parses when an
empty `thread_id` shifts fields). `ncl tasks list` truncates `prompt` to 120 chars (trailing `...`) →
read with `ncl tasks get <id> --json`. `ncl approvals` holds pending rows only → a shrinking pending
count is NOT evidence of an answer. `last_active` is mutable → never re-verify a stored time-window
figure later (the row moved; treat a backward replay as a floor). A config payload with backticks/`$`/`!`
must be passed as an argv element, not through a double-quoted shell string; and a write whose verify is
chained in the same shell command shares the write's failure mode, so it cannot witness it. ⭐ Common
thread: **when a write reports success and a read-back contradicts it, suspect the READ first** — verify
with a different verb before believing the write failed.
