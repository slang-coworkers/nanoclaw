---
title: "slang-pr-review-runner patch mode: reviewer can't find the patch + commit -am drops new files"
type: learning
topic: review-process
source: learnings/1780311762982-slang-pr-review-runner-patch-mode-reviewer-can-t-f.md
---

# slang-pr-review-runner patch mode: reviewer can't find the patch + commit -am drops new files

When running `slang-pr-review-runner compose-and-run --mode patch` (Reviewer A), two real harness issues degrade or break the run, independent of any transient API error:

1. **Inner reviewer hunts for the patch file and hits its sandbox wall.** The prompt template (repro.sh) tells the model `REPO=(local-patch)`, `PR=(patch:<file>)`, and "to see what the PR changes, use `gh pr diff`" — but in patch mode there is no PR. The wrapper has already applied the patch to a temp branch (`patch-review-<epoch>`) off `origin/master` and checked it out. The model doesn't realize this and burns its early turns running `find /workspace/agent -name '*.patch'` / `Glob **/<file>.patch` to locate the patch. Those fail because the inner CLI's sandbox only allows `/workspace/agent/slang` (the patch lives in `/workspace/inbox/...`). The model should instead inspect `git log -p origin/master..HEAD` / `git show HEAD` / `git diff origin/master...HEAD` on the checked-out temp branch.

2. **`git commit -am` never stages NEW files.** compose-and-run.sh patch mode does `git apply <patch>` then `git commit -am`. `-a` only stages modifications/deletions of *tracked* files, so any *new* files the patch adds (e.g. new `tests/*.slang`) stay untracked and are NOT in the committed temp-branch diff. A reviewer diffing `origin/master..HEAD` therefore won't see the new test files. (Fix would be `git add -A` before commit — but that changes the pipeline; don't silently alter it for a "faithful retry".)

**Operational notes:**
- If the wrapper is killed/hangs before its patch-mode cleanup runs, it leaves the repo stranded ON the temp branch and leaves the patch's new untracked files in the tree. Recover with: `git checkout origin/master`, `git branch -D patch-review-<epoch>`, then `rm` the byte-identical leftover new files (verify identity against the patch first). Leave unrelated untracked files and other sessions' branches alone.
- **pgrep self-match gotcha:** a background waiter using `until ! pgrep -f "<long cmdline>"` will match ITS OWN command line (the pattern string is in its argv), so the loop never sees the target die and runs to its deadline reporting "process still alive". Match on a PID, a child-process name, or `pgrep -f` a string that won't appear in the waiter's own argv.
- Two fix-11374 patch-mode runs failed back-to-back for infra reasons: first SIGTERM/143 (resource kill), then `API Error: The socket connection was closed unexpectedly` at turn 6 (~5.6 min, $0.62). Neither reflects on patch content. Patch applied cleanly to base each time.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780311762982-slang-pr-review-runner-patch-mode-reviewer-can-t-f.md`_
