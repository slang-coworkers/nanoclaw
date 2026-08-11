---
name: feedback_a_pruned_worktree_makes_git_show_a_silent_empty_file
description: "A sibling session pruning my git worktree turned `git show <ref>:<file> > out.sh` into a 0-byte file, and `bash out.sh` exited 0 — a false PASS that would have inverted a P1 finding. Redirection captures stdout; the fatal goes to stderr and the rc is discarded."
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1170
---

# A pruned worktree makes `git show > file` produce an EMPTY file, and running it exits 0

**Measured 2026-08-10**, reviewing nanoclaw#1170 ([[project_nanoclaw_1170_stale_rc_dead_under_set_e]]).

I had a P1: a new `STALE_RC=$?` branch in `setup/merge-train.sh` is dead under `set -euo pipefail`.
To confirm it against the **merged** blob rather than my earlier extract, I ran, from inside a
worktree of the shared clone:

```bash
git show origin/nv-main:setup/merge-train.sh > /tmp/merge-train-nvmain.sh
... bash /tmp/merge-train-nvmain.sh nv-main   # → SCRIPT_RC=0 for BOTH rc=1 and rc=2
```

`SCRIPT_RC=0` on both means *"no abort, both branches reachable"* — **the exact opposite of my
finding**. I was one step from retracting a correct P1.

## Why it happened

A **sibling session pruned my worktree registration** mid-review. `/workspace/agent/nanoclaw-kb/.git/worktrees/`
held `wt-1171` and `wt-1171-base`; my `tree1170` was gone, though `tree1170/.git` still pointed at it.
So `git show` died with `fatal: not a git repository: …/worktrees/tree1170`.

⭐ **The redirection had already truncated the file to 0 bytes before git failed**, the `fatal` went
to **stderr** (invisible in my grep-filtered output), and I never checked git's rc. `bash` on an
empty script exits **0**. Three independent facts conspired to produce a confident inversion.

## What caught it — and what would have caught it sooner

Caught by the `diff` in the same command block printing **267 `>` lines** ("everything added"),
which is only possible if one side is empty. Cheaper guards, in order:

1. ⭐⭐⭐**`wc -l` the extracted file and compare against the expected size** — one line, no git
   needed, catches truncation from any cause.
2. ⭐⭐**Always include a POSITIVE CONTROL row in the matrix.** My redo added `checker_rc=0`, which
   must print `done — …`. An empty script prints nothing, so the control fails loudly instead of the
   real cases failing silently toward "pass".
3. Check `git show`'s rc, or use `git show … || exit 1`. Redirection + `set -e`-less shell discards it.

## The general shape

⛔ **A tool whose output is captured by redirection reports failure on a channel you are not
reading, and the empty result is then consumed as valid input.** This is the same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] and
[[feedback_exit_zero_empty_is_not_a_measured_zero]] — here the false zero is an *exit code from an
empty program* rather than a grep count.

⇒ **On a shared clone, worktree registration is not durable state** — a sibling's `git worktree
prune` (or `gc`) removes it while your `.git` pointer file survives, so the failure appears at your
NEXT git call, not at creation. See [[feedback_group_clone_is_shared_by_all_sessions]] and
[[feedback_tracked_mods_on_a_shared_clone_is_a_reading_not_a_state]].
⇒ **Remedy that worked:** `git clone --no-checkout` into `/tmp`, fetch the PR ref, check out there.
An independent clone has no shared registration for anyone else to prune. Cost ~2s.
