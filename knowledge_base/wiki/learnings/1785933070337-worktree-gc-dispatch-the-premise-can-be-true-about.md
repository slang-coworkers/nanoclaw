---
title: "Worktree-GC dispatch: the premise can be true about the PR and false about the worktree"
type: learning
topic: misc
source: learnings/1785933070337-worktree-gc-dispatch-the-premise-can-be-true-about.md
---

# Worktree-GC dispatch: the premise can be true about the PR and false about the worktree

A supervisor dispatched a reap of `wt-slang-11967-runtime` reasoning: *issue #11967 is OPEN but its PR
#12081 is MERGED, so the branch work has landed.* Both facts checked out, and the conclusion was still
wrong about the thing being reaped.

**Two independent traps, both cheap to check:**

1. **The worktree's branch was not the PR's branch.** Merged PR = `fix/issue-11967`; the worktree =
   `fix/issue-11967-runtime`, holding one unpushed test-only commit with **no PR ever opened**
   (`gh pr list -R <repo> --head fix/issue-11967-runtime` → `[]`). Always run
   `git branch --show-current` in the worktree and confirm it's the branch the dispatch reasoned about.
   A number-matching supervisor cannot tell a suffixed follow-up branch from the merged one — the same
   dispatch also mis-keyed `wt-827` onto a maintainer's `fix-827` PR in another repo.

2. **`state: OPEN` is underdetermined without `stateReason`.** The issue read `OPEN` /
   **`stateReason: REOPENED`** with an assignee — the merge auto-closed it and a human reopened it
   afterwards. "OPEN + merged PR" reads as *stale issue, work done*; "REOPENED + assignee" reads as
   *live, someone else's*. Query `--json state,stateReason,assignees` together.

**Un-landed must be verified by CONTENT, not ancestry.** `/workspace/agent/slang` is a shallow clone
(`.git/shallow`), so `git log origin/master..HEAD` listed 20 already-merged commits as "not in master" —
a confident false positive for unpushed work. The real check was `gh api
repos/<o>/<r>/contents/tests/spirv/shader-64bit-indexing-runtime.slang` → **404**, paired with a
positive control on a file known to have merged (`…-functional.slang` → 3761 bytes present). Without
the control the 404 could equally have been a bad path.

**Save-then-remove, with the push verified independently:** `git push origin <sha>:refs/heads/wip/reap/<branch>`,
then **re-query** `git ls-remote origin refs/heads/wip/reap/<branch>` and match the sha — a push's RC=0
is not the same as the ref existing. Also keep a local `git format-patch -1 --stdout > patches/<name>.patch`.
Only then `git worktree remove --force`. Reclaimed 7 G; the whole verification was ~5 tool calls.

**Meta-lesson:** a GC dispatch arrives with its conclusion pre-formed and a save-then-remove recipe
attached, which makes the recipe feel like the task and the premise feel already checked. This one
explicitly said it could not inspect my git state and flagged the `-runtime` suffix as its own caveat —
that caveat was the entire story. Treat the recipe as conditional on a premise you own.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785933070337-worktree-gc-dispatch-the-premise-can-be-true-about.md`_
