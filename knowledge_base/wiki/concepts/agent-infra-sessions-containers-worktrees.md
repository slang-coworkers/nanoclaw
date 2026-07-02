---
title: "Sessions, Containers, and Worktrees in Agent Infrastructure"
type: concept
group: agent-infra
tags: [sessions, containers, worktrees, disk, build, ncl, nanoclaw, agent-runner, onecli]
source_count: 25
---

# Sessions, Containers, and Worktrees in Agent Infrastructure

This page covers the runtime mechanics of NanoClaw agent containers: how sessions map to containers, worktree isolation and hazards, disk management, container config, GPU availability, and observability tools.

## Container Lifecycle and Restarts

Restarting the nanoclaw main service triggers `initGroupFilesystem` for all agent groups, which refreshes skill mtimes and recomposes CLAUDE.md; the host sweep then detects the stale hash and kills every running container with `claude-md-stale`. Avoid service restarts during active sessions; batch multiple fixes into a single restart ([Restarting nanoclaw main service triggers initGroupFilesystem → skill refresh → CLAUDE.md recompose → claude-md-stale kills all running containers. Avoid restarts during active sessions.](wiki/learnings/legoop-feedback_service_restart_kills_containers.md)). For dashboard-only changes restart only `nanoclaw-*-dashboard`; for MCP server fixes `pkill` the MCP subprocess rather than the full service.

When a container restarts mid-task the host may spawn a recovery fork that inherits the original container's filesystem snapshot but not its live processes. A pre-restart belief like "pid 447 running, monitor will notify me" is void — the event will never fire. Resolving split-brain correctly means deferring report ownership to the claimed-primary, keeping a silent stall-insurance run, and setting a failsafe takeover deadline ([Resolving reviewer split-brain after a container restart (recovery fork vs. original)](wiki/learnings/1780488405089-resolving-reviewer-split-brain-after-a-container-r.md)). A peer in a separate container namespace cannot disarm your timers or processes.

## Container Configuration and Package Management

Per-group container config lives in the `container_configs` table and is managed via `ncl groups config`. Key lessons from the slang-fixer rebuild incident:

- Debian Bookworm standard repos ship no `clang-format`; installing versions 17/18 requires the LLVM apt repo (`apt.llvm.org`) or a Dockerfile-level change — `ncl groups config add-package` alone is insufficient ([ncl group container fixes — Bookworm package gaps + approval sequencing](wiki/learnings/1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md)).
- Stale broken config entries (broken apt packages, 404 npm packages) stay dormant until the first rebuild. Before attempting a fix, eyeball the full config with `ncl groups config get --id <gid>` and remove ALL broken entries in one batch — each rebuild burns an admin approval card.
- Never fire `ncl groups restart --rebuild` in parallel with pending config-change approvals: the rebuild can race ahead and generate its Dockerfile from the stale config snapshot.

## GPU Availability in Containers

Slang coworker containers have an NVIDIA L40S GPU (driver 565.57.01, CUDA 12.7, ~46GB VRAM), verified in both Main and slang-fixer containers as of 2026-06-17. CLAUDE.md / skill docs that say "environment does not have a GPU" are stale. Always verify empirically with `nvidia-smi` rather than trusting documentation ([Slang coworker containers HAVE an NVIDIA GPU (L40S) — 'no GPU' docs are stale; verify with nvidia-smi](wiki/learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md)).

However, the GPU is NOT turnkey for `slang-test`. Vulkan real-GPU path does not work because `NVIDIA_VISIBLE_DEVICES=void` on coworker containers — the NVIDIA container toolkit injects compute but not graphics/Vulkan. Enabling GPU Vulkan requires a host-side container-runtime change beyond `install_packages`. CUDA: `slang-test` reports `cuda: Not Supported` (no nvrtc runtime present).

## Filesystem Layout and Disk Management

`/workspace/agent` is its own mount (`/dev/vdb`, ~251G) separate from `/workspace` (`/dev/vda1`, ~124G). Always run `df -h /workspace/agent` rather than bare `df -h` or `df /workspace` — a blocker can be a measurement artifact if the wrong mount is checked ([Disk-blocker false alarm: df the real build path, /workspace/agent is a separate roomy volume](wiki/learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md)).

The `/workspace/agent` mount fills from accumulated per-worktree `build/` directories (each slang Debug build is ~6–7.6 GB; ~17 worktrees = ~115 GB). The correct reclaim lever is `rm -rf <wt>/build` — fully safe, zero-work-loss, regenerable — not removing whole worktrees ([Disk-full on /workspace/agent: prune worktree build/ dirs, not whole worktrees](wiki/learnings/1782151532732-disk-full-on-workspace-agent-prune-worktree-build-.md), [Slang fixer container disk fills from accumulated build/ trees](wiki/learnings/1782148249067-slang-fixer-container-disk-fills-from-accumulated-.md)).

Full `git worktree remove` is only safe when ALL hold: issue CLOSED + PR merged/closed + branch is on origin + NO uncommitted tracked changes. Never remove a worktree with local-only commits — the branch ref survives a `git worktree remove --force` but would be lost if you also `git branch -D` it ([Worktree-GC reap: safe-execution facts (branch refs survive; workflows-perm blocks wip/reap; pipefail bug)](wiki/learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md)).

When multiple concurrent fix chains fill the shared mount, safe unblocks in order: (1) out-of-source build on the free `/dev/vda1` disk, (2) wait for in-flight siblings to finish, (3) admin volume expansion ([slang-fixer shared mount fills with in-flight build trees — don't reclaim siblings](wiki/learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md)). Do NOT blindly reclaim sibling worktrees — `container_status=stopped` does NOT mean abandoned.

When `/workspace` is near-full and `/dev/vdb` is not an option, you can symlink the build directory to the root overlay (`ln -s /home/node/<build-dir> /workspace/agent/wt-<n>/build`), but the overlay is ephemeral: a container restart wipes it entirely ([slang clone env: build on root overlay when /workspace full; create PRs via gh REST api (gh pr create is blocked)](wiki/learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md)).

`codex` runs in a separate process and cannot see `/tmp`; any artifact codex must read (PR body, plan) must live under `/workspace`. Also `/tmp` is wiped between Bash invocations in the fixer container ([codex-critique artifacts must live under /workspace, not /tmp (ephemeral + invisible to codex)](wiki/learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md)).

## Session Observability and the NCL CLI

`ncl sessions list` returns a capped page (~202 rows) sorted oldest-first, so the newest sessions — the ones you're most likely checking — are truncated out. Never grep the output of plain `ncl sessions list` to check whether a downstream handoff succeeded. Use `ncl sessions list --thread-id gh-issue-<owner>/<repo>-<N>` instead ([ncl sessions list is capped — use --thread-id for handoff verification](wiki/learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md)).

When a fixer appears stalled (no remote branch, no tagged session), these are WEAK signals — fixers do real work in unpushed local worktrees. The decisive test is a bounded concrete-status probe. Only escalate to a targeted session restart after a confirmed silent/empty response ([Fixer stall diagnosis — unpushed worktree vs dead session](wiki/learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md)).

Session transcripts can be rendered as browsable HTML: the `/show-transcript` skill runs `uvx claude-code-transcripts all -s data/v2-sessions/<id>/.claude-shared/projects -o /tmp/<target>-html --include-agents` then `python3 -m http.server 8080`. The tool is `uvx` (Python via uv), not `npx`. OneCLI proxy intercepts localhost; use `env -u http_proxy -u https_proxy curl` to verify the server ([How to render any agent group's Claude Code session transcripts as browsable HTML on port 8080](wiki/learnings/legoop-reference_show_transcript_skill.md)).

## Worktree Isolation and Git Mechanics

Running Reviewer A and Reviewer C in parallel against the same `/workspace/agent/slang` checkout races on `.git/index.lock`. The fix is to give Reviewer C its own worktree: `git worktree add --detach /workspace/agent/slang-clarity-wt origin/master`; `run-clarity.sh` honors `REPO_ROOT` ([slang reviewer A+C parallel: use git worktree to avoid .git/index.lock race](wiki/learnings/1780679350358-slang-reviewer-a-c-parallel-use-git-worktree-to-av.md), [slang-pr-review: isolate Reviewer A and C with a git worktree + REPO_ROOT override](wiki/learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md)).

`git stash` is repo-global across all worktrees sharing one `.git` — `git stash clear` wipes EVERY worktree's stashes. Never use `git stash clear` in a shared clone; to discard your own uncommitted changes use `git reset --hard HEAD`. Recovery after accidental `git stash clear`: the underlying commit objects survive until GC; recover with `git fsck --unreachable --no-reflogs | grep 'unreachable commit'` followed by `git stash store` ([git stash is repo-global across worktrees — never `git stash clear`](wiki/learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md)).

When adopting a pre-existing shared worktree, verify it is not live: `git -C <worktree> status` shows the current branch and state; `gh pr list --repo <r> --state all --search "head:fix/issue-<n>"` checks for already-open slice PRs. Empty-branch and no-sentinel checks are point-in-time snapshots that a live concurrent session can invalidate ([Slices/shared worktree can be live: verify branch + open slice PRs before adopting (don't trust empty-branch/no-sentinel)](wiki/learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md)).

`git push --force-with-lease` (without explicit value) uses the remote-tracking ref as lease basis. If only a different ref was fetched, the branch's remote-tracking ref is never materialized and the push is rejected as "stale info." Fix: `git ls-remote origin <branch>` then `git push --force-with-lease=<branch>:<that-sha> origin <branch>` ([git push --force-with-lease 'stale info' after rebase in a worktree](wiki/learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md)).

Fresh `git worktree add` for slang needs `git submodule update --init --recursive` before `cmake --preset default`; the shared `.git/modules/` cache makes this fast. The base clone lives at `/workspace/agent/slang-real`, not `/workspace/agent/slang`, and the default branch is `master` not `main` ([slang-fixer worktree setup: base is slang-real, submodules + master branch + watcher gh fields](wiki/learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md), [Slang PR label is 'pr: breaking change' not 'pr: breaking'; fresh worktrees need submodule init](wiki/learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md)).

Worktree-GC reap is operator-gated; a `/supervise` auto-cron re-deriving the GC set is NOT the authorization grant. `git worktree remove --force` does not delete the branch ref — only the working directory and `.git/worktrees/<id>` admin entry. The bot cannot push branches touching `.github/workflows/*.yml`; this kills the `save-then-remove` wip/reap recipe for those worktrees ([Worktree-GC reap: safe-execution facts (branch refs survive; workflows-perm blocks wip/reap; pipefail bug)](wiki/learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md)).

## May 14 Session: Key Infrastructure Fixes

The May 14 2026 session landed four infrastructure PRs: (#335) fixed all four Slang workflows whose step bodies were silently empty (H2 headers don't match the composer's step parser — only numbered-list format works); (#336) added `validate-templates.ts` CI gate; (#337) made new non-admin coworkers auto-bind to admin messaging group; (#338) fixed `detectStaleContainers` silent bypass when `spawnedClaudeMdHash` Map was empty after a host restart ([May 14 session — landed PRs](wiki/learnings/legoop-project_session_may14.md)).

---
**Source learnings (26):**
- [Restarting nanoclaw main service triggers initGroupFilesystem → CLAUDE.md recompose → kills all containers](wiki/learnings/legoop-feedback_service_restart_kills_containers.md)
- [Resolving reviewer split-brain after a container restart](wiki/learnings/1780488405089-resolving-reviewer-split-brain-after-a-container-r.md)
- [ncl group container fixes: Bookworm package gaps + approval sequencing](wiki/learnings/1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md)
- [Slang coworker containers have an NVIDIA GPU (L40S) — "no GPU" docs are stale](wiki/learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md)
- [Disk-blocker false alarm: df the real build path](wiki/learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md)
- [Disk-full on /workspace/agent: prune worktree build/ dirs, not whole worktrees](wiki/learnings/1782151532732-disk-full-on-workspace-agent-prune-worktree-build-.md)
- [Slang fixer container disk fills from accumulated build/ trees](wiki/learnings/1782148249067-slang-fixer-container-disk-fills-from-accumulated-.md)
- [Worktree-GC reap: safe-execution facts (branch refs survive; workflows-perm blocks wip/reap; pipefail bug)](wiki/learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md)
- [slang-fixer shared mount fills with in-flight build trees](wiki/learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md)
- [slang clone env: build on root overlay when /workspace full](wiki/learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md)
- [codex-critique artifacts must live under /workspace, not /tmp](wiki/learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md)
- [ncl sessions list is capped — use --thread-id for handoff verification](wiki/learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md)
- [Fixer stall diagnosis — unpushed worktree vs dead session](wiki/learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md)
- [How to render agent group session transcripts as browsable HTML](wiki/learnings/legoop-reference_show_transcript_skill.md)
- [slang reviewer A+C parallel: use git worktree to avoid .git/index.lock race](wiki/learnings/1780679350358-slang-reviewer-a-c-parallel-use-git-worktree-to-av.md)
- [slang-pr-review: isolate Reviewer A and C with a git worktree + REPO_ROOT override](wiki/learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md)
- [git stash is repo-global across worktrees — never git stash clear](wiki/learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md)
- [Slices/shared worktree can be live: verify branch + open slice PRs before adopting](wiki/learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md)
- [git push --force-with-lease "stale info" after rebase in a worktree](wiki/learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md)
- [slang-fixer worktree setup: base is slang-real, submodules + master branch + watcher gh fields](wiki/learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md)
- [Slang PR label is 'pr: breaking change' not 'pr: breaking'; fresh worktrees need submodule init](wiki/learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md)
- [Testing slang-llvm version-skew diagnostics + Slang worktree/build env gotchas](wiki/learnings/1780324487740-testing-slang-llvm-version-skew-diagnostics-slang-.md)
- [slang-pr-review-runner patch mode: reviewer can't find the patch + commit -am drops new files](wiki/learnings/1780311762982-slang-pr-review-runner-patch-mode-reviewer-can-t-f.md)
- [slang-pr-review: claude CLI recovers from mid-stream 504 — don't kill a stalled reviewer run](wiki/learnings/1781729409164-slang-pr-review-claude-cli-recovers-from-mid-strea.md)
- [Reviewer C clarity inner-CLI socket-close — salvage path + cheap re-run](wiki/learnings/1780730287968-reviewer-c-clarity-inner-cli-socket-close-salvage-.md)

_Catalog: [[wiki/index.md]]_
