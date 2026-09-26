---
title: "Sessions, Containers, and Worktrees in Agent Infrastructure"
type: concept
group: agent-infra
tags: [sessions, containers, worktrees, disk, build, ncl, nanoclaw, agent-runner, onecli, scheduled-task, cron, observability]
source_count: 38
---

# Sessions, Containers, and Worktrees in Agent Infrastructure

Runtime mechanics of NanoClaw agent containers: restarts and reaps, container config and GPU, disk, builds inside fixer sessions, worktree isolation and GC, publish/mirror jobs, and session observability.

## TL;DR
- **A service restart is a fleet-wide kill.** Restarting the nanoclaw main service recomposes every group's CLAUDE.md and the sweep kills every running container as `claude-md-stale`. Batch fixes into one restart, never restart during active sessions, and scope narrow (dashboard-only service; `pkill` the MCP subprocess).
- **After a restart, beliefs about live processes are void.** A recovery fork inherits files, not processes; a monitor armed before the restart never fires, and a peer in another container cannot disarm your timers.
- **Commit tests and code before any long build.** A session reap deletes the worktree and its uncommitted edits with no stash or dangling object left; a commit on the fix branch is crash-safe (amend after).
- **Never background a long build in a fixer session.** Foreground it (ninja resumes incrementally) or run it detached with a `BUILD_EXIT=` marker, and watch that marker plus the binary, never a bare `pgrep -f 'cmake --build'` (matches siblings). `TaskStop` on a build subagent SIGINTs your ninja.
- **Bound every hold.** A fixer parked "waiting for a build slot" emits nothing and looks dead (chains have gone ~97h silent); poll with a deadline and emit a blocker plus ETA.
- **Worktree GC is operator-gated and always save-then-remove:** check status and ahead-count, push to `wip/reap/<branch>`, verify on origin, then remove. "Obviously safe" reap framings are often wrong.
- **The dirname is a hint; gitdir, branch, and remote are ground truth.** A `wt-<issue>` can hold another still-open branch or another repo. A vanished worktree dir does not delete its branch; check `git branch --list` and `git ls-remote` before saying "the code is gone."
- **`git worktree remove --force` keeps the branch ref; `git branch -D` loses work.** Delete a branch only if checked out nowhere and never pushed, and disclose it.
- **Sibling worktrees share one `.git`:** `git stash clear` wipes every sibling's stashes (use `git reset --hard HEAD`), and any sibling's SHA resolves locally, so test ancestry, not resolvability.
- **Reclaim `build/` dirs, not worktrees** (~6–7.6 GB each, regenerable; `container_status=stopped` is not abandoned). `df` the exact build path: `/workspace/agent` is a separate, roomier mount.
- **The root overlay and `/tmp` are ephemeral**, and codex cannot see `/tmp`. Anything another process must read lives under `/workspace`.
- **Isolate parallel reviewers and builds in their own worktrees.** Shared checkouts race on `.git/index.lock` and clobber staging paths, so a reviewer can read the wrong PR's diff.
- **A container reset can corrupt submodule trees** while HEAD and gitlink look fine: run `git submodule update --init --recursive --force`, not CMake debugging; re-install pip tools.
- **`ncl sessions list` is a capped, oldest-first page.** Verify handoffs with `--thread-id`. A cron fire is its own row with empty `messaging_group_id` and `created_at` on the cron boundary.
- **Verify container capabilities empirically.** Containers have an NVIDIA GPU despite docs, yet Vulkan and CUDA `slang-test` paths do not work.
- **Remove broken container-config entries in one batch**; each rebuild burns an approval, and a `--rebuild` racing pending approvals uses the stale snapshot.
- **A mirror copies whatever is in the source now.** Assert no nested VCS/scratch dirs and compare file counts before publishing; a redaction check validates only the encoding it can read.

## Container Lifecycle and Restarts

Restarting the nanoclaw main service runs `initGroupFilesystem` for every group, refreshing skill mtimes and recomposing CLAUDE.md; the host sweep then sees the stale hash and kills every running container with `claude-md-stale` ([service restart kills all containers](../learnings/legoop-feedback_service_restart_kills_containers.md)). For dashboard-only changes restart only `nanoclaw-*-dashboard`; for an MCP server fix `pkill` the MCP subprocess.

A mid-task restart may spawn a recovery fork with the original's filesystem but none of its processes, so "pid 447 running, monitor will notify me" is void. Resolve reviewer split-brain by deferring report ownership to the claimed primary, keeping a silent stall-insurance run, and setting a failsafe takeover deadline ([reviewer split-brain](../learnings/1780488405089-resolving-reviewer-split-brain-after-a-container-r.md)).

Autocompact-thrash is not fixed by a container restart or `groups restart` (neither is `/clear`); history poison needs a true session clear or retire. Peers flag it once to the parent and then stay off the session, because inbounds worsen the loop ([restart ≠ /clear](../learnings/1783934716626-autocompact-thrash-recovery-container-restart-clea.md)).

From the May 14 2026 session: the composer's step parser matches only numbered-list steps, so H2-step workflows had silently empty bodies (#335); `detectStaleContainers` was bypassed when the `spawnedClaudeMdHash` Map was empty after a host restart (#338); also landed the `validate-templates.ts` CI gate (#336) and non-admin coworker auto-bind to the admin messaging group (#337) ([May 14 session](../learnings/legoop-project_session_may14.md)).

## Container Configuration, Packages, and GPU

Per-group config lives in `container_configs`, managed via `ncl groups config` ([Bookworm gaps + approval sequencing](../learnings/1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md)). Bookworm's standard repos ship no `clang-format`; 17/18 need the `apt.llvm.org` repo or a Dockerfile change, not just `add-package`. Broken entries (bad apt packages, 404 npm packages) stay dormant until the first rebuild, so read `ncl groups config get --id <gid>` and remove all of them in one batch. Never fire `ncl groups restart --rebuild` alongside pending config approvals; it can build from the stale snapshot.

Slang coworker containers have an NVIDIA L40S (driver 565.57.01, CUDA 12.7, ~46 GB VRAM), verified in Main and slang-fixer on 2026-06-17; "no GPU" docs are stale ([containers have an L40S](../learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md)). It is not turnkey for `slang-test`: `NVIDIA_VISIBLE_DEVICES=void` injects compute but not graphics, so real-GPU Vulkan needs a host runtime change beyond `install_packages`, and CUDA reports `cuda: Not Supported` (no nvrtc).

## Filesystem Layout and Disk Management

`/workspace/agent` is its own mount (`/dev/vdb`, ~251 GB), separate from `/workspace` (`/dev/vda1`, ~124 GB); run `df -h /workspace/agent`, since a disk blocker is often a measurement artifact ([df the real build path](../learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md)). Usage can swing wildly across resets (observed 99% to 10%).

The mount fills from per-worktree `build/` dirs (~6–7.6 GB per slang Debug build; ~17 worktrees ≈ 115 GB). The lever is `rm -rf <wt>/build`, zero-loss and regenerable ([disk fills from build/ trees](../learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md)). When concurrent chains fill it, unblock in order: out-of-source build on the free `/dev/vda1`, wait for in-flight siblings, then admin volume expansion; never blindly reclaim siblings ([don't reclaim siblings](../learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md)).

A fixer "holding for a build slot" behind `/dev/vdb` contention is idle and emits nothing. On 2026-07-11 two no-PR chains with committed fixes (slang #11967, #11970) went ~97h silent until a supervisor nudge. A bot-last, no-PR, silent chain is a promise still owed, not a human handoff; fixers bound such holds by polling with a deadline and emitting a blocker plus ETA. Reaping closed-chain worktrees freed the volume (100% to 46 GB free) and let both builds resume ([silent build-slot holds](../learnings/1783772920595-silent-build-slot-holds-behind-disk-contention-fre.md)).

As a last resort when `/workspace` is full, symlink the build dir to the root overlay (`ln -s /home/node/<build-dir> /workspace/agent/wt-<n>/build`); a container restart wipes it ([build on root overlay](../learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md)). `codex` runs in a separate process that cannot see `/tmp`, and `/tmp` is wiped between Bash invocations, so codex inputs (PR body, plan) live under `/workspace` ([codex artifacts under /workspace](../learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md)).

## Builds and Worktree Setup in Fixer Sessions

On slang#9153 a fixer was reaped ~2 days in while a subagent ran a debug build; tests and code that lived only in `wt-<n>/` were gone and the branch stub had 0 commits. Commit on `fix/issue-<n>` right after writing, before the build; after a suspected reap, establish ground truth (`git log master..fix/issue-<n>`, `git stash list`, `git fsck`) before reporting, and never trust a subagent's ambiguous "I'll wait…" ([commit before the long build](../learnings/1784385072886-session-reap-deletes-worktree-mid-build-commit-tes.md)).

A backgrounded build's completion signal is routinely lost across reaps (idle-exit, restart, autocompact teardown), so drive long builds in the foreground ([never background a long build](../learnings/1783953647247-never-background-a-long-build-in-a-fixer-session-f.md)). A delegated build watched by `pgrep -f "cmake --build --preset debug"` fires a false "done" when a sibling worktree's build ends (seen on #12069), and `TaskStop` on the subagent SIGINTs your ninja because `cmake --build` is its child. Run it detached (`nohup bash -c '... >LOG 2>&1; echo "BUILD_EXIT=$?" >>LOG' & disown`), Monitor `until grep -q "BUILD_EXIT=" LOG`, and branch on `BUILD_EXIT=0` plus `[ -x build/Debug/bin/slangc ]` ([pgrep matches siblings](../learnings/1785468785000-build-subagent-monitor-pgrep-matches-sibling-workt.md)).

A fresh slang `git worktree add` needs `git submodule update --init --recursive` before `cmake --preset default` (else a missing `SPIRV-Headers::SPIRV-Headers` target); the shared `.git/modules/` cache makes it fast. The base clone is `/workspace/agent/slang-real`, the default branch `master`, the bot pushes `fix/issue-<n>` to origin, and the label is `pr: breaking change` ([worktree setup](../learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md), [label + submodule init](../learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md), [env gotchas](../learnings/1780324487740-testing-slang-llvm-version-skew-diagnostics-slang-.md)). `clang-format` is absent; `pip install --break-system-packages --user "clang-format>=17,<19"` puts it in `~/.local/bin`.

A container reset can corrupt submodule trees while HEAD, edits, and gitlink survive: configure fails at `add_subdirectory given source "lz4/build/cmake" which is not an existing directory`, `git submodule status` looks normal, but `git -C external/<sub> status` shows many `D build/...` entries. Run `git submodule update --init --recursive --force`, then a clean rebuild (~40 min, configure first). A reset keeps commits but wipes uncommitted state, `build/`, and pip-installed `clang-format` ([reset corrupts submodule trees](../learnings/1784324456149-container-reset-can-corrupt-submodule-working-tree.md)).

## Worktree Isolation for Parallel Reviewers

Reviewer A and Reviewer C on the same `/workspace/agent/slang` checkout race on `.git/index.lock`; give C its own worktree (`git worktree add --detach /workspace/agent/slang-clarity-wt origin/master`; `run-clarity.sh` honors `REPO_ROOT`) ([A+C index.lock race; REPO_ROOT override](../learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md)). Reviewer A (`compose-and-run.sh`) defaults to the shared checkout and stages `$REPO_ROOT/tmp/pr-diff.patch`, so a second run clobbers it and the first run's subagents review the wrong diff (`INTEGRITY-FAIL.txt`, ~20 min lost). Run A in `git worktree add --detach /workspace/agent/wt-<PR>-reviewA <base-sha>` with `REPO_ROOT` set; Reviewer C already isolates via `wt-clarity-*` ([concurrent runs clobber tmp/](../learnings/1784771691413-slang-pr-review-concurrent-runs-clobber-shared-che.md)).

In `--mode patch` the wrapper applies the patch to `patch-review-<epoch>` off `origin/master`, but the inner reviewer hunts for the patch file outside its sandbox instead of reading `git diff origin/master...HEAD`, and `git commit -am` never stages new files, so new tests are missing ([patch mode gaps](../learnings/1780311762982-slang-pr-review-runner-patch-mode-reviewer-can-t-f.md)).

A reviewer whose `stream.jsonl` freezes after an `api_retry` 504 is usually alive; the CLI retries itself. Bound-watch for output, process death, or ~10–15 min of sustained zero growth before treating it as skipped ([CLI recovers from 504](../learnings/1781729409164-slang-pr-review-claude-cli-recovers-from-mid-strea.md)). If Reviewer C's inner CLI dies on a socket close, the wrapper exits 0 but `clarity-review.md` holds only the error (check size, grep "API Error"); `rm -f tmp/review-candidates/pr-<N>-clarity.md` and re-run (~$3–5); if that also fails, the raw candidates are usable only as labeled advisory input from a degraded run ([socket-close salvage](../learnings/1780730287968-reviewer-c-clarity-inner-cli-socket-close-salvage-.md)).

## Git Mechanics Across Shared Worktrees

`git stash` is repo-global, so `git stash clear` wipes every worktree's stashes; discard your own changes with `git reset --hard HEAD`, and recover a clear via `git fsck --unreachable --no-reflogs | grep 'unreachable commit'` plus `git stash store` ([stash is repo-global](../learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md)). The shared object store also means `git cat-file -t <sha>` → `commit` does not prove the SHA is yours: a peer attached a sibling's run `31287329842` @ `49dbe8c165` (`fix/issue-12383`) to a PR whose head was `9a24322dd3`. Check with `git merge-base --is-ancestor <sha> <your-branch>` or the PR's `headRefOid` ([resolving is not belonging](../learnings/1786280483668-resolving-is-not-belonging-sibling-worktrees-share.md)).

Before adopting a shared worktree, check `git -C <worktree> status` and `gh pr list --repo <r> --state all --search "head:fix/issue-<n>"`; empty-branch and no-sentinel checks are snapshots a live session can invalidate ([shared worktree can be live](../learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md)). A bare `--force-with-lease` fails with "stale info" if the branch's remote-tracking ref was never fetched; use `git ls-remote origin <branch>` then `--force-with-lease=<branch>:<sha>` ([force-with-lease stale info](../learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md)).

## Worktree GC and Reaping

A `/supervise` cron re-deriving the GC set is not authorization. Full removal is safe only when the issue is closed, the PR merged or closed, the branch on origin, and nothing uncommitted. `git worktree remove --force` deletes only the directory and `.git/worktrees/<id>`, not the branch ref. The bot cannot push branches touching `.github/workflows/*.yml`, which breaks the `wip/reap` save for those ([reap safe-execution facts](../learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md)). Never skip save-then-remove; "merged slice" and "throwaway experiment" framings are often wrong ([save-then-remove is mandatory](../learnings/1783951066058-worktree-gc-save-then-remove-is-mandatory-reap-fra.md)).

On 2026-08-03 `wt-slang-12244-doc` was reaped because #12244 was closed and PR #12248 merged, but it held `fix/shadowgrad-doc-followup` for still-open draft PR #12309; save-then-remove confirmed `98083f9d5e` was on origin first. Resolve the real branch (gitdir pointer, or ask the owner) before dispatching a reap, and journal an unexpected branch as its own chain ([dirname can diverge from branch](../learnings/1785716211648-worktree-gc-dirname-issue-number-can-diverge-from-.md)). A `wt-<issue>` may belong to `slangpy-samples`; `cat wt-<n>/.git` shows the gitdir. If the parent `.git` is gone, `rm -rf` is the only path, after `find wt-<n> -type f -newermt "<checkout>"` and a diff against a live sibling ([wt may belong to slangpy-samples](../learnings/1784507002898-worktree-gc-wt-lt-issue-gt-may-belong-to-slangpy-s.md)).

After a container or disk migration a vanished worktree dir does not mean lost commits; branches live in the base clone. Run `git branch --list 'fix/issue-<n>'` and `git ls-remote origin 'refs/heads/fix/issue-<n>'` and report both; on slang#11983 the removed dir's `fix/issue-11983` at `e35f89ec7b` was intact but unpushed. `git branch -D` only when `git worktree list | grep <name>` and the `ls-remote` are both empty, and disclose it ([vanished dir keeps its branch](../learnings/1784283551975-a-vanished-git-worktree-dir-does-not-delete-its-br.md)).

## Session Observability and the ncl CLI

`ncl sessions list` returns a capped page (~202 rows) sorted oldest-first, so the newest are truncated; use `--thread-id gh-issue-<owner>/<repo>-<N>` ([sessions list is capped](../learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md)). A scheduled task runs in its own session, a row with empty `messaging_group_id` and `created_at` on the cron boundary. Task sessions silently drop `<message>` blocks (use `send_message`), and `ncl sessions messages` truncates `text` (read the `truncated` flag) ([task-session signature](../learnings/1786240364490-scheduled-task-sessions-drop-message-blocks-silent.md)).

No remote branch and no tagged session are weak stall signals, since fixers work in unpushed worktrees; the decisive test is a bounded status probe, and a targeted restart follows only a confirmed silent response ([stall diagnosis](../learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md)). `/show-transcript` renders HTML via `uvx claude-code-transcripts all -s data/v2-sessions/<id>/.claude-shared/projects -o /tmp/<target>-html --include-agents` and `python3 -m http.server 8080` (`uvx`, not `npx`); verify with `env -u http_proxy -u https_proxy curl` since OneCLI intercepts localhost ([show-transcript](../learnings/legoop-reference_show_transcript_skill.md)).

## Publish and Mirror Jobs

A nested `.git` in a tree about to be published is a scrub bypass no text check can see. On 2026-08-06 the nightly `knowledge_base` sync (slang-coworkers/nanoclaw to `nv-coworkers`) found the auto-memory source `/home/node/.claude/projects/-workspace-agent/memory/` had become a git repo after the recipe was written, and `cp -rL <src>/. <dest>/` copied its `.git/`. `scrub_kb_pii.py` rewrites working-tree text only, so zlib-compressed `.git/objects` pass it and the `grep -rhoE '<email regex>'` check by construction, and committing them publishes the unscrubbed history. The tell was a count: ~520 files expected, 10,011 mirrored, 772 under `knowledge_base/auto-memory/.git`. Compare against `git ls-tree -r --name-only HEAD <path> | wc -l` before staging. The fix (PR #1094) removes `auto-memory/.git` and `__pycache__` dirs after the mirror and before the scrub. The exclusion belongs in the mirror step, not in an operator's memory, and every publish-to-public job asserts `find <dest> -type d \( -name .git -o -name node_modules -o -name __pycache__ -o -name .venv \)` is empty ([nested .git is a scrub bypass](../learnings/1785985612990-a-nested-git-in-a-mirrored-tree-is-a-pii-scrub-byp.md)).

**Source learnings (38):**
- [Nested .git is a PII-scrub bypass](../learnings/1785985612990-a-nested-git-in-a-mirrored-tree-is-a-pii-scrub-byp.md) — prune VCS dirs in the mirror; gate on file count.
- [Resolving is not belonging](../learnings/1786280483668-resolving-is-not-belonging-sibling-worktrees-share.md) — shared object store; test ancestry.
- [GC dirname can diverge from branch](../learnings/1785716211648-worktree-gc-dirname-issue-number-can-diverge-from-.md) — wt-slang-12244-doc held PR #12309's branch.
- [Build Monitor pgrep matches siblings](../learnings/1785468785000-build-subagent-monitor-pgrep-matches-sibling-workt.md) — false done; TaskStop kills ninja.
- [Session reap deletes worktree mid-build](../learnings/1784385072886-session-reap-deletes-worktree-mid-build-commit-tes.md) — commit before the long build.
- [wt-<issue> may belong to slangpy-samples](../learnings/1784507002898-worktree-gc-wt-lt-issue-gt-may-belong-to-slangpy-s.md) — read the gitdir before `rm -rf`.
- [Service restart kills all containers](../learnings/legoop-feedback_service_restart_kills_containers.md) — CLAUDE.md recompose → `claude-md-stale`.
- [Reviewer split-brain after restart](../learnings/1780488405089-resolving-reviewer-split-brain-after-a-container-r.md) — recovery fork; defer to primary.
- [Bookworm gaps + approval sequencing](../learnings/1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md) — batch removals; no racing rebuild.
- [Containers have an NVIDIA L40S](../learnings/1781698400173-slang-coworker-containers-have-an-nvidia-gpu-l40s-.md) — docs stale; Vulkan/CUDA unusable.
- [df the real build path](../learnings/1780381873486-disk-blocker-false-alarm-df-the-real-build-path-wo.md) — /workspace/agent is a separate volume.
- [Disk fills from build/ trees](../learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md) — ~6–7.6 GB per Debug build.
- [Reap safe-execution facts](../learnings/1782710777380-worktree-gc-reap-safe-execution-facts-branch-refs-.md) — refs survive; workflows-perm blocks wip/reap.
- [Shared mount fills with in-flight builds](../learnings/1782305359829-slang-fixer-shared-mount-fills-with-in-flight-buil.md) — don't reclaim siblings.
- [Build on root overlay](../learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md) — last resort; ephemeral.
- [Codex artifacts under /workspace](../learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md) — /tmp is wiped and invisible.
- [ncl sessions list is capped](../learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md) — use --thread-id.
- [Fixer stall diagnosis](../learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md) — bounded status probe first.
- [Render transcripts as HTML](../learnings/legoop-reference_show_transcript_skill.md) — /show-transcript via uvx.
- [REPO_ROOT override](../learnings/1781121669041-slang-pr-review-isolate-reviewer-a-and-c-with-a-gi.md) — isolate A and C.
- [git stash is repo-global](../learnings/1782524288491-git-stash-is-repo-global-across-worktrees-never-gi.md) — never `stash clear`; fsck recovery.
- [Shared worktree can be live](../learnings/1781318983764-slices-shared-worktree-can-be-live-verify-branch-o.md) — verify branch + PRs first.
- [force-with-lease stale info](../learnings/1781225377051-git-push-force-with-lease-stale-info-after-rebase-.md) — explicit lease SHA.
- [Fixer worktree setup](../learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md) — slang-real; submodules; master.
- [Label + submodule init](../learnings/1780482951162-slang-pr-label-is-pr-breaking-change-not-pr-breaki.md) — `pr: breaking change`.
- [slang-llvm skew + env gotchas](../learnings/1780324487740-testing-slang-llvm-version-skew-diagnostics-slang-.md) — submodules, pip clang-format, origin.
- [Patch-mode gaps](../learnings/1780311762982-slang-pr-review-runner-patch-mode-reviewer-can-t-f.md) — `commit -am` drops new files.
- [CLI recovers from 504](../learnings/1781729409164-slang-pr-review-claude-cli-recovers-from-mid-strea.md) — don't kill a stalled run.
- [Reviewer C socket-close salvage](../learnings/1780730287968-reviewer-c-clarity-inner-cli-socket-close-salvage-.md) — exit 0 ≠ valid; re-run.
- [Silent build-slot holds](../learnings/1783772920595-silent-build-slot-holds-behind-disk-contention-fre.md) — ~97h silent; bound holds.
- [Never background a long build](../learnings/1783953647247-never-background-a-long-build-in-a-fixer-session-f.md) — foreground; ninja resumes.
- [Autocompact-thrash: restart ≠ /clear](../learnings/1783934716626-autocompact-thrash-recovery-container-restart-clea.md) — needs true clear/retire.
- [Save-then-remove is mandatory](../learnings/1783951066058-worktree-gc-save-then-remove-is-mandatory-reap-fra.md) — reap framings often wrong.
- [Vanished dir keeps its branch](../learnings/1784283551975-a-vanished-git-worktree-dir-does-not-delete-its-br.md) — check branch --list + ls-remote.
- [Reset corrupts submodule trees](../learnings/1784324456149-container-reset-can-corrupt-submodule-working-tree.md) — `submodule update --force`.
- [Concurrent reviews clobber tmp/](../learnings/1784771691413-slang-pr-review-concurrent-runs-clobber-shared-che.md) — isolate Reviewer A.
- [Task sessions drop `<message>` blocks](../learnings/1786240364490-scheduled-task-sessions-drop-message-blocks-silent.md) — use send_message; cron row signature.
- [May 14 session](../learnings/legoop-project_session_may14.md) — parser #335, stale-detect #338, #336, #337.

_Catalog: [[wiki/index.md]]_
