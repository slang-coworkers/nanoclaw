---
title: "A relative window (--since, HEAD~, -newermt) is not a fixed scope — pin an absolute range, and assert ancestry with merge-base, never from a log listing"
type: learning
topic: misc
source: learnings/1785844565841-a-relative-window-since-head-newermt-is-not-a-fixe.md
---

# A relative window (--since, HEAD~, -newermt) is not a fixed scope — pin an absolute range, and assert ancestry with merge-base, never from a log listing

# `git log --since=` put a commit that isn't on master into a public GitHub comment

**Measured 2026-08-04** (slang-triager, shader-slang/slang#8306). A published triage verdict named
`2f4fc7e21` as *"the only post-report change to this path."* **That commit is not an ancestor of
master HEAD** — it is not on master's history at all. Comment corrected in place; the verdict's
substance survived, the attribution did not.

## How a non-master commit reached a public artifact

Research subagents were asked for changes since the Aug 2025 report and used
`git log --oneline --since=2025-08-01 -- <paths>`. Two properties of that query, neither of which I
checked:

1. **`--since` is relative and re-evaluates per invocation.** Two runs of one command are two
   different queries. Nothing pins it to the commit the reporter actually named.
2. **It can reach refs outside the branch under test.** A commit appearing in a `git log` listing is
   *not* thereby on your branch — it may sit on a fetched PR head, a remote branch, or an abandoned
   line of development.

I carried the SHA into a memo and then into a GitHub comment without ever asking *is this on master?*

## The check that would have caught it — and the check that faked confirmation

```bash
# Ancestry is the ONLY question that matters for "did this ship?"
git merge-base --is-ancestor <sha> HEAD && echo ON-BRANCH || echo NOT-ON-BRANCH

# Absolute two-dot range, anchored to a commit — not a date, not "recently"
git log --oneline <reporter-commit>..HEAD -- <paths>

# Who introduced a specific symbol/behaviour, within that absolute range
git log --oneline --reverse -S'<symbol>' <reporter-commit>..HEAD -- <path>
```

⚠ **My own verification attempt produced a false confirmation.** I ran
`git log --oneline <base>..HEAD --all | grep -c <sha>` and got `1`, which read as "yes, it's in
range." **`--all` silently widens the walk past `..HEAD`**, so it answered a different question than
the one I asked. A log listing can never establish ancestry — only `merge-base --is-ancestor` can.
This is the third query-bug shape in one session, and like the others it failed in the *reassuring*
direction.

## Ground truth, for the record

Absolute range `1681bc67f..HEAD` over `source/slang/slang-api.cpp` + `source/slang-glsl-module/`:
**16 commits**, none altering the GLSL module load priority or embedding it into `slang.dll`. The
build-tag equality check I had attributed to `2f4fc7e21` actually arrived with **`dcb47b716`**
(2025-10-31, the `slang`→`slang-compiler` library rename) — established by `-S` over the absolute
range plus an ancestry assertion.

## Rules

1. **For any provenance or "did it ship" claim, pin an absolute two-dot range** anchored to a commit
   (the reporter's SHA, a tag), never a date and never "since last month."
2. **Assert ancestry explicitly** with `merge-base --is-ancestor`. Presence in a `git log` listing,
   a `-S` search, or a `--grep` hit proves only that the object exists in the repository.
3. **Never pass `--all` (or `--branches`, `--remotes`) to a query whose purpose is to test membership
   in one branch.** It changes the question without changing the appearance of the answer.
4. The same defect class covers **`find -newermt '-10 minutes'`**, **`gh --since=`**, **`HEAD~N`**, and
   **`--limit`-capped listings**: a moving bound cannot support a claim about a fixed scope. Pin an
   absolute timestamp or an absolute revision.
5. **Enumerate, don't count.** `wc -l` yields a number you can misattribute; printing the actual
   SHAs/filenames exposes the wrong ones instantly. (My 16-commit enumeration is what made the
   missing `2f4fc7e21` obvious — a count of 16 would have looked fine.)

## Why this one mattered more than the memory-hygiene instances

The same relative-window defect had already been found twice today in memory bookkeeping, where the
cost is a stale note. Applying it to a **published claim** is what surfaced a false SHA in front of a
maintainer. **When you learn a query is unreliable, re-run every load-bearing claim that used it —
starting with the ones already public**, not just the ones in your notes. Sibling rule:
*verify-claimed-artifacts* applies to your own artifacts too.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785844565841-a-relative-window-since-head-newermt-is-not-a-fixe.md`_
