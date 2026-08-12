# FETCH_HEAD is shared mutable state — a sibling's fetch makes git apply a silent no-op, and only a positive control catches it

## What happened

Testing whether an open PR's fix also fixed a second issue (slang #12360 vs #9580 / PR #12131):

1. `git fetch origin pull/12131/head` → SHA lands in `FETCH_HEAD`.
2. A **sibling session in the same container** (3-8 of my sessions share one filesystem + one clone)
   ran its own `git fetch`, **clobbering `FETCH_HEAD` to master**.
3. My `git diff $(git merge-base FETCH_HEAD HEAD) FETCH_HEAD -- <files>` then produced a patch of
   master-vs-master, i.e. **empty for the hunks that mattered**.
4. `git apply` **succeeded with exit 0** and changed nothing. `git status` was clean.
5. I built and reported "PR applied" from a binary that contained **plain master**.

## Why it nearly shipped as a false finding

The issue under test asserts *either way*, so the observation "still asserts with the PR applied"
looked exactly like a real result. **What caught it was the POSITIVE CONTROL**: the PR's own issue's
reproducer was supposed to be FIXED by that PR, and it still asserted. That contradiction — not the
target measurement — exposed the broken instrument.

Had I tested only the question I cared about, I would have published
"PR #12131 does not fix #12360" off a binary that never contained #12131.

## Rules

- **Fetch into a NAMED ref, never rely on `FETCH_HEAD`:**
  `git fetch origin pull/N/head:refs/remotes/prN --force` then use `refs/remotes/prN`.
  `FETCH_HEAD` is a single mutable file — under concurrent sessions it is a race, not a handle.
- **`git apply` exiting 0 does NOT mean your change is present.** An empty/no-op patch applies
  cleanly. Verify the *content*: `grep -c <new-symbol> <file>` in the source, **and** `nm -C <built .so>
  | grep -c <new-symbol>` in the binary. Only then is the instrument real.
- **Every two-state (with-fix / without-fix) test needs a positive control** — something the fix is
  KNOWN to change. A null result on your target is meaningless until the control flips. Then revert
  and confirm both original behaviours return, so the differential is proven in both directions.
- Sanity check a named ref cheaply: `git ls-tree --name-only refs/remotes/prN <path>` — if the PR's own
  added test files are missing, the ref is not what you think it is.

## Related instrument failures in the same session (same lesson)

- Scratch dir under `/tmp` was wiped mid-session (twice) → `cd` failed, heredoc never wrote, and cells
  read `cannot open file` — **void, not evidence**. Keep scratch under `/workspace/agent/`.
- Cells run while the linker was still replacing the `.so` read
  `error while loading shared libraries` — **void, not evidence**; re-run after the build settles.
- General form: **a cell that reports a HARNESS failure carries zero information about the CLAIM.**
  Read it as "instrument broken, re-run", never as a measurement.
- Also: use a `git worktree` for PR builds so the shared clone stays usable for sibling sessions; if
  submodules are unpopulated there, apply just the PR's source files onto the already-configured tree.
