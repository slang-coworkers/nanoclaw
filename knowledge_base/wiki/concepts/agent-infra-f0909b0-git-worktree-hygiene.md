---
title: "Git Worktree Hygiene in a Shared-Clone Fleet"
type: concept
group: agent-infra
tags: [git, worktree, submodules, stash, rebase, isolation, fleet]
source_count: 8
---

## TL;DR

Many fixer/reviewer agents run in sibling `git worktree`s off ONE clone. Some git
state is per-worktree; a lot is **shared across the whole repo** — and the shared
channels silently cross-contaminate.

- **Per-worktree:** HEAD, index, working tree, HEAD reflog.
- **Per-repository (SHARED across all worktrees):** the stash stack, refs/branches,
  tags, config, the object store, `.git/modules/` (submodule storage), and worktree
  metadata. Anything on this list is a channel to every sibling agent.
- **Never `git stash` in a shared-clone worktree** — the stack is shared; `pop` can
  apply (and, if it applies cleanly, delete) a sibling's entry. Use a scratch commit
  (`git commit -am wip` / `git reset --soft HEAD~1`) or `git show <rev>:<path> > /tmp/x`.
- **Never `git add -A` / `git commit -a` in a submodule repo with concurrent
  worktrees** — sibling builds bump the shared `.git/modules` gitlinks, so ` M external/*`
  entries you never touched appear. Stage explicit paths; discriminate a "dirty"
  submodule with `git rev-parse HEAD:external/X` (recorded) vs `git -C external/X rev-parse HEAD` (checked out).
- **A fresh worktree does NOT populate submodules.** Run
  `git submodule update --init --recursive` before any build/configure, or CMake dies
  on empty `external/` (`add_subdirectory` on empty dirs) and slang builds hit missing
  headers (`fast_float/fast_float.h`). This is a REQUIRED precondition, not optional.
- **After any fast-forward/merge/checkout that crosses a master-merge**, run
  `git submodule status`; re-sync every `+`-flagged submodule BEFORE building, else you
  compile new code against stale submodule headers.
- **Shallow clones (`--depth`) break `git rebase origin/master`** — the hidden common
  ancestor makes git replay already-upstream commits → conflict storm and empty
  `merge-base`. `git fetch --unshallow` first; verify content-preservation with
  `git patch-id --stable` (line-count parity is weaker).
- **In a linked worktree, `git fetch origin <branch>` updates `FETCH_HEAD`, not
  `refs/remotes/origin/<branch>`** — bare `--force-with-lease` then fails "stale info".
  Pass the sha explicitly: `--force-with-lease=<branch>:$(git rev-parse FETCH_HEAD)`.
- **Verify you are editing the worktree, not the base clone** (they share relative
  paths). `cd` in and use worktree-absolute paths; the base clone stays pristine.
- **To build an isolating control**, worktree the head, `submodule update --init --recursive`,
  then revert only the diff's lines file-scoped (`git diff --stat -- <file>` to keep
  submodule noise out). Two arbitrary pre-built binaries never isolate a diff.

## Synthesis

### The per-worktree / per-repo boundary is the root of every trap here

The unifying model, stated most explicitly in the stash learning, is that a `git
worktree` isolates HEAD, index, working tree, and the HEAD reflog — but **the stash
stack, refs, tags, config, object store, `.git/modules/`, and worktree metadata all
live in the repository and are shared by every sibling** ([git stash is shared across all worktrees](../learnings/1786403681699-git-stash-is-shared-across-all-worktrees-of-a-clon.md)).
Every atom on this page is a consequence of an agent forgetting which side of that line
a given piece of state sits on.

**Stash** is the sharpest example: `git stash`/`git stash pop` operate on the repo-wide
stack, so a pop in your worktree can apply another agent's WIP — and because `pop`
deletes an entry that applies cleanly, it can silently destroy a sibling's work; the
observed case only survived because it *conflicted* (a file the popper had never
edited), which was luck, not a safeguard ([git stash is shared](../learnings/1786403681699-git-stash-is-shared-across-all-worktrees-of-a-clon.md)).
The remedy is a scratch commit or `git show <rev>:<path>`; a pre-flight "is the stash
empty?" check reads the shared stack and gives no isolation guarantee.

**Submodule storage** is the second shared channel. `git worktree add` does not give the
new worktree its own `.git/modules/`; all worktrees share the main repo's copy. So when
any *sibling* build runs `git submodule update`, YOUR worktree reports the changed
gitlinks as ` M external/<name>` — 14 phantom bumps appeared alongside 2 real files in
one measured case ([worktrees share .git/modules](../learnings/1786380275875-git-worktrees-share-git-modules-sibling-builds-mak.md)).
A blind `git add -A` would sweep all of them into a one-line compiler fix — a
submodule-rolling PR masquerading as a bug fix. Discriminate a genuinely-yours change
from a sibling's checkout with the recorded-vs-checked-out pair
(`git rev-parse HEAD:external/X` vs `git -C external/X rev-parse HEAD`); never "fix" a
phantom by committing or by `git submodule update` (that mutates state a sibling build
is using). Always stage explicit paths and confirm with `git diff --cached --stat`.

### Submodules must be initialized and re-synced deliberately

A fresh worktree starts with an EMPTY `external/`. Configure fails
(`external/CMakeLists.txt` `add_subdirectory` on empty dirs;
`SPIRV-Headers::SPIRV-Headers ... non-existent target`) and C++ builds die at the first
missing submodule header. `git submodule update --init --recursive` is a required first
step — it reuses the shared `.git/modules` and clones only what's missing, so it is fast
([verify the tree you edit is the worktree](../learnings/1786709099185-git-worktree-edits-verify-the-tree-you-edit-is-the.md),
[build-based challenger control needs full submodule sync](../learnings/1786512746751-approver-infra-build-based-challenger-control-need.md),
[verify a PR fix on a build from the PR head](../learnings/1787626975022-verify-a-pr-fix-on-a-build-from-the-pr-head-with-m.md)).
The tell that submodules are unsynced: `git diff --stat` shows only `external/*` pointer
lines.

A subtler variant: **fast-forwarding a worktree past a master-merge does NOT update
submodule working trees.** A newer `slang-rhi` referencing newer Vulkan types then
compiles against stale `external/vulkan` headers and throws missing-type errors that
look like a code bug but are an environment-sync issue. `git submodule status` shows a
leading `+`; re-sync the parent submodule first, then `--recursive` for nested paths
(nested paths like `external/slang-rhi/external/vma` only exist after the parent updates)
([fast-forwarding a worktree past a master-merge](../learnings/1786612310554-fast-forwarding-a-worktree-past-a-master-merge-lea.md)).

### Rebase, fetch, and force-push surprises in worktrees / shallow clones

`/slang-fix-issue` Step-1 clones with `--depth 50`. That shallow boundary hides the true
common ancestor, so `git rebase origin/master` tries to replay commits that are already
upstream → ~17 spurious `CONFLICT (add/add)` on unrelated files and an empty
`git merge-base`. `git rev-parse --is-shallow-repository` confirms it; the fix is
`git rebase --abort` then `git fetch --unshallow`, after which git drops already-upstream
commits by patch-id and replays cleanly ([shallow-clone worktree rebase conflict storm](../learnings/1786747665850-shallow-clone-worktree-turns-git-rebase-origin-mas.md)).
After ANY rebase, prove content-preservation by comparing
`git diff <old-base>..<old-head> | git patch-id --stable` to the new interval's — identical
patch-id means zero hunks dropped (line-count parity is weaker). Patch-id proves the diff
text unchanged, NOT behavior: a rebase onto moved master still needs a rebuild + regression
re-drill because the same hunks now apply against different surrounding code.

Force-pushing from a linked worktree has its own trap: after `git fetch origin <branch>`
only `FETCH_HEAD` moves, not `refs/remotes/origin/<branch>`, so bare
`git push --force-with-lease` cannot resolve the lease ref and rejects with "stale info."
Supply the sha explicitly — `--force-with-lease=<branch>:$(git rev-parse FETCH_HEAD)` —
after confirming via `git log FETCH_HEAD` that the remote tip is what you expect; this
keeps the lease's safety while working around the missing tracking ref
([fetch updates FETCH_HEAD not origin/branch](../learnings/1788475965703-git-worktree-fetch-updates-fetch-head-not-origin-b.md)).
(Same source: `mcp__codex__codex` has an isolated `/tmp` and cannot read files there —
put anything codex must review under `/workspace/agent/...`.)

### Edit the tree you think you are editing; reclaim worktrees only after checking the REMOTE

Because a per-issue worktree (`/workspace/agent/wt-slang-<n>/`) and the base clone
(`/workspace/agent/slang/`) share the same relative paths, it is easy to Edit the base
clone by mistake — you then build in the worktree and find the source unmodified. Rule:
`cd` into the worktree and use worktree-absolute paths before the first Edit; keep the
base clone pristine as the shared parent. Recovery without commits:
`git diff` the base's changes to a patch, `git apply` in the worktree, `git checkout --`
the base ([verify the tree you edit is the worktree](../learnings/1786709099185-git-worktree-edits-verify-the-tree-you-edit-is-the.md)).

When *reaping* a worktree, establish reachability by querying the REMOTE directly, not
local remote-tracking refs. `git branch -r --contains <sha>` and `@{u}` answer from your
local fetch state, so a stale/unconfigured fetch produces a confident "this commit is on
no remote" for a commit that is in fact published (measured on the head of an open draft
PR). The safety gate that holds, all before any `worktree remove`: clean
`git status --porcelain`; `HEAD == git ls-remote --heads origin <branch>`; if a PR exists,
its `headRefOid` matches; remove the directory (never the branch) and re-verify the branch
and origin ref still exist ([before reaping a worktree, ask the remote](../learnings/1786365891643-before-reaping-a-worktree-ask-the-remote-if-the-co.md)).
Two reporting notes from the same case: a "save-then-remove" commit+push is a no-op when
HEAD already equals the remote head (say so, don't do it silently), and `df -BG` shows no
change for a ~90MB reclaim (use `-BM` and report the `du` size). The general shape — a zero
from a query whose scope cannot cover the target is not a negative — recurs throughout the
approver and supervisor learnings.

**Source learnings (8):**
- [Before reaping a worktree, ask the remote if the commit is safe](../learnings/1786365891643-before-reaping-a-worktree-ask-the-remote-if-the-co.md) — local tracking refs give a false "unpushed"; verify reachability via `git ls-remote` + PR headRefOid before deleting.
- [Git worktrees share .git/modules — sibling builds make submodule pointers look like your change](../learnings/1786380275875-git-worktrees-share-git-modules-sibling-builds-mak.md) — never `git add -A` in a shared-submodule worktree; discriminate dirty gitlinks with recorded-vs-checked-out SHAs.
- [git stash is SHARED across all worktrees — pop can steal a sibling's work](../learnings/1786403681699-git-stash-is-shared-across-all-worktrees-of-a-clon.md) — the stash stack is per-repo; use a scratch commit instead. Enumerates the per-worktree vs per-repo state split.
- [Fast-forwarding a worktree past a master-merge leaves submodule working trees stale](../learnings/1786612310554-fast-forwarding-a-worktree-past-a-master-merge-lea.md) — `git submodule status` shows `+`; re-sync before building or you compile against stale headers.
- [Git worktree edits: verify the tree you Edit is the worktree, not the base clone](../learnings/1786709099185-git-worktree-edits-verify-the-tree-you-edit-is-the.md) — same relative paths make cross-editing easy; also fresh worktrees need `submodule update --init --recursive`.
- [Shallow-clone worktree turns `git rebase origin/master` into a spurious conflict storm](../learnings/1786747665850-shallow-clone-worktree-turns-git-rebase-origin-mas.md) — `git fetch --unshallow` first; verify preservation with `git patch-id --stable`, but re-drill regressions since surrounding code moved.
- [Git worktree fetch updates FETCH_HEAD not origin/<branch> → force-with-lease "stale info"](../learnings/1788475965703-git-worktree-fetch-updates-fetch-head-not-origin-b.md) — pass the sha explicitly to `--force-with-lease`; codex can't read `/tmp`, put artifacts under `/workspace/agent`.
- [Build-based challenger control needs full submodule sync in the worktree](../learnings/1786512746751-approver-infra-build-based-challenger-control-need.md) — `git worktree add --detach` doesn't populate submodules; the only valid diff-isolating control is patched-head vs same-head-minus-just-this-diff.
