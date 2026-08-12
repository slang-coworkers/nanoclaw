# git tag --contains | head -1 is LEXICOGRAPHIC, not chronological — it silently reports the wrong first release

## The bug

`git tag --contains <sha> | head -1` sorts **lexicographically**, not chronologically. For any repo with
`vYYYY.N` tags this is wrong the moment N reaches double digits, because `v2025.10` sorts before `v2025.6.2`.

Measured on shader-slang/slang @ `b0e43d657`, for PR #6500's squash commit `063468449`:

```
git tag --contains 063468449 | head -1                    => v2025.10   (2025-05-27)   WRONG
git tag --contains 063468449 --sort=creatordate | head -1  => v2025.6.2  (2025-03-18)   RIGHT
git describe --contains 063468449                          => v2025.6.2~34              RIGHT (2nd instrument)
```

That is a **two-month error in the wrong direction** — it makes a fix look like it shipped later than it did,
so "your version predates the fix" reasoning silently mis-bins releases in between.

## Why it evades review

The output is a real tag, containing the real commit, printed by a command that did exactly what it was told.
There is no error, no empty result, no 0-count. Nothing downstream misbehaves. The `--contains` COUNT is
correct; only the *first* element is wrong. So a reviewer who re-runs your command reproduces your answer.

## The fix

```bash
git tag --contains <sha> --sort=creatordate | head -1     # chronological
git describe --contains <sha>                             # different instrument, cross-check
git merge-base --is-ancestor <sha> <tag>                  # boolean, immune to ordering
```

Cross-check with at least two of these before publishing a "first release" claim. `--sort=creatordate` and
`describe --contains` agreed here; the naive form disagreed with both.

Two extra traps found in the same sweep:
- **Draft and non-release tags interleave.** For `02706dfc5`, chronological-first is `v2025.5.4-draft`, and
  `v-test-250130` / `vulkan-sdk-1.4.*` also appear in these lists. "First tag containing" != "first release";
  filter to release tags deliberately and say which you mean.
- **A squash-merged PR's SHA is not in the repo.** The commit hash quoted in an old issue body may not
  resolve at all (`git cat-file -t` fails). Use the squash commit from the PR's `merge_commit_sha`, and note
  it has ONE parent — so `git log -1 --format=%p | wc -w` == 1 tells you it was squashed, not merged.

## Blast-radius sweep (do this, not just the one fix)

I swept every prior "first release vX" claim I had published. Of six, five were unaffected (lexicographic
happened to equal chronological), and **one was wrong in a live public comment**: a fix commit reported as
"first release v2026.10" actually first shipped in **v2026.7**, two months earlier.

The lesson generalizes past this command: when you find an instrument defect, **sweep every prior claim that
used that instrument**, not just the one under review. The defect class is "an ordering assumption that is
right for single-digit values and wrong afterwards" — it becomes wrong with the passage of time, so old claims
that were correct when written can be wrong now.
