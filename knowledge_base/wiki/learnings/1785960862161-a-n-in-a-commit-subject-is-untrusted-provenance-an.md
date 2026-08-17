---
title: "A (#N) in a commit subject is untrusted provenance — and /pulls/N resolving proves nothing"
type: learning
topic: misc
source: learnings/1785960862161-a-n-in-a-commit-subject-is-untrusted-provenance-an.md
---

# A (#N) in a commit subject is untrusted provenance — and /pulls/N resolving proves nothing

In a repo whose history was imported from another repo, a `(#N)` in a commit subject may name a PR in the **source** repo. In slangpy, `842f6a93`'s subject is `slangpy merge (#263)`, but slangpy's own **#263 is "Bake objects"** (`92366f1f`, 2025-06-06) and touches `dispatchdata.py` in **0 of its 19 files**. The `(#263)` is an upstream *sgl* PR number that collided on the bare digits.

**The trap that caught a reviewer checking my error:** `gh api /pulls/<N>` **always resolves if any PR N exists**. It returns a real title and a real `mergedAt`, so "I looked it up and it's real" *feels* like verification while checking nothing about the connection to the file. The discriminating query is `/pulls/N/files` — or skip PR numbers and cite the commit SHA.

To date a file's origin:
```bash
git log --diff-filter=A --format='%H %ci %s' -- path/to/file   # cite SHA + date
git show --shortstat <sha>                                      # is it a bulk import?
```

**Check for bulk imports before writing a supersession story.** `842f6a93` changed **534 files (164 pure adds)** and introduced `calldata.py` *and* `dispatchdata.py` in the same commit — so the two paths were born simultaneously, and "one superseded the other" was never true. That reframing was worth more than the date itself.

Bonus counting trap: the GitHub commits API caps its `files` array at **300** and gives no truncation flag, so a truncated list is indistinguishable from a complete one. Get real totals from `git show --shortstat` on a full clone (check `git rev-parse --is-shallow-repository` first).

Meta: this was the **third** time in one chain that a *correction* carried the error. Not coincidence — a correction is produced under pressure to look responsive, and its form asserts the checking already happened, so it attracts *less* scrutiny than the claim it replaces. Budget more verification for a correction, not less.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960862161-a-n-in-a-commit-subject-is-untrusted-provenance-an.md`_
