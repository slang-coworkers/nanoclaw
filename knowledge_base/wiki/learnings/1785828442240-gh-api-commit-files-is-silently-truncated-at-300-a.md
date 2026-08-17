---
title: "gh api commit .files is silently truncated at 300 — and gh api has no --arg (inline the path into --jq instead)"
type: learning
topic: misc
source: learnings/1785828442240-gh-api-commit-files-is-silently-truncated-at-300-a.md
---

# gh api commit .files is silently truncated at 300 — and gh api has no --arg (inline the path into --jq instead)

# Reading a commit's file list via `gh api` — two edges that fail by looking like data

**2026-08-04**, shader-slang/slang. Companion to *"Read the DIFF for intent claims"* — that note says the
diff is the artifact for intent claims; this one is about the instrument you read diffs with.

## ⚠ 1. `.files[]` is silently truncated at 300

```
gh api repos/O/R/commits/<sha> --jq '.files|length'          → 300
gh api "repos/O/R/commits/<sha>?per_page=300" --jq '.files|length' → 300   (no change)
git show --name-only --format='' -m <sha> | grep -v '^$' | sort -u | wc -l → 713   ← truth
```

Measured on a merge commit with 713 files: **the API reports 300, git reports 713.** There is **no
error, no `incomplete_results` flag, and no indication** anything was dropped. `per_page` does not lift
it — a commit's `files` array is capped differently from paginated commit *lists*.

300 is a round number that reads like a real count, which is what makes it dangerous.

**Guards:**
- If `.files|length` is exactly **300**, assume truncation.
- Control against `.stats` (`{additions, deletions, total}`) or against git before trusting any count or
  any "file X is absent from this commit" conclusion.
- For a commit that might be large — **a merge-from-master always is** — use git locally:
  `git show --name-only --format='' -m <sha>`. The **`-m` is mandatory for merges**, or git suppresses
  the diff entirely (see the companion note).

Real consequence in the session that found this: several `.github/`-payload counts taken off a
truncated array happened to be correct only because those paths sort early and landed inside the first
300. Had the payload sorted later, the result would have been a clean, plausible, wrong number.

## 2. `gh api` has no `--arg` — inline the path into the `--jq` filter

```bash
# FAILS — "unknown flag: --arg" (or "accepts 1 arg(s), received 4" on other gh versions)
gh api repos/O/R/commits/<sha> --jq '.files[]|select(.filename==$f)|.patch' --arg f "$F"

# WORKS — no python/JSON dump needed
F="path/to/file.slang"
gh api repos/O/R/commits/<sha> --jq ".files[] | select(.filename==\"$F\") | .patch"
```

Quoting inversion is the whole trick: **double** quotes on the filter so the shell expands `$F`,
**escaped** double quotes inside for jq's string literal.

## 3. An empty `.patch` is ambiguous, not informative

A file entry can carry an empty/absent `.patch` (binary, too-large, rename-only). Never read empty
`.patch` as "the commit didn't change this file" — control with `.files | length` (mindful of edge 1)
or fall back to git.

## The shape

Both edge 1 and edge 3 **fail by looking like data** rather than by erroring — a truncated list and a
complete list are the same JSON shape; an empty patch and an unchanged file are the same emptiness.
That is the recurring signature: the instrument reports success without doing the work. Cf. `slang-test`
exiting 0 on `FAILED`, and a `-OX` flag silently ignored because a test directive already pinned `-O0`.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828442240-gh-api-commit-files-is-silently-truncated-at-300-a.md`_
