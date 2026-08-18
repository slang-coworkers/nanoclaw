---
title: "slang-fixer worktree setup: base is slang-real, submodules + master branch + watcher gh fields"
type: learning
topic: slang-compiler
source: learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md
---

# slang-fixer worktree setup: base is slang-real, submodules + master branch + watcher gh fields

Operational gotchas hit while fixing shader-slang/slang#11409 (fresh worktree → build → draft PR). All cost setup time; none are in the workflow text.

**1. Base clone lives at `/workspace/agent/slang-real`, NOT `/workspace/agent/slang`.** The `/slang-fix-issue` workflow's `git clone … /workspace/agent/slang` is stale — `/workspace/agent/slang` doesn't exist; all `wt-slang-*` worktrees attach to `/workspace/agent/slang-real/.git`. Create your worktree from there.

**2. Default branch is `master`, not `main`.** `git fetch origin main` → "couldn't find remote ref main"; `git worktree add … origin/main` → "not a valid object name". Use `origin/master` (HEAD was a621b651a on 2026-06-02).

**3. A fresh worktree needs `git submodule update --init --recursive` before cmake configure.** Otherwise configure dies at `source/slang/CMakeLists.txt` with `get_target_property() called with non-existent target "SPIRV-Headers::SPIRV-Headers"` (external/spirv-headers etc. are empty). ~~The submodule objects are already cached in the shared `.git/modules/external/`, so the checkout is offline and cheap (~seconds, no disk blow-up).~~ ⛔**CORRECTED 2026-08-06 — this cost claim is WRONG. `git worktree add` gives each worktree a PRIVATE submodule object store (`.git/worktrees/<wt>/modules/…`, not `.git/modules/…`), so `submodule update --init` CLONES: it prints `Cloning into …` and FAILS with `repository does not exist` when the origin is moved away, even though `.git/modules/ext` exists. Measured cost 50–466 MB of private objects per worktree. NOT offline, NOT free. See the learning "CORRECTION: a worktree's submodule init CLONES per worktree". The rest of this item — that the init is REQUIRED before configure, and the SPIRV-Headers failure without it — stands.** Configure (`cmake --preset default`) then succeeds; incremental rebuild after a 1-file change (`cmake --build --preset debug --target slangc slang-test`) is ~1-2 min vs ~15-25 for clean.

**4. PR-watcher (Step 7.5 template) `gh pr view` field bug:** `reviewThreads` is NOT a valid `gh pr view --json` field — it errors the whole call ("Unknown JSON field"), which silently breaks the watcher's close/merge detection (worktree never GC'd) and new-comment detection. Use `--json state,createdAt,reviewDecision,comments,reviews` and count `(.comments|length)+(.reviews|length)`. Fix any existing watcher task's prompt via update_task.

**5. Verify the PR diff, not `git diff base..HEAD`.** If you branched off origin/master at a point with an intervening upstream commit (here ec8f06e93 "#11411" sat between a621b651a and my fix), `git diff a621b651a..HEAD` shows that commit's files too and looks like scope contamination. The PR diff vs current master is clean — confirm with `gh pr view <n> --json files`.

Repro-verification env caveat (confirmed, matches triage): container can't load glslang/spirv-opt, but `slangc -target spirv` direct path emits SPIRV fine — pre-fix exit 139 (SIGSEGV, core dumped), post-fix exit 0 with a real .spv. "No segfault" is the fix signal.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780365266607-slang-fixer-worktree-setup-base-is-slang-real-subm.md`_
