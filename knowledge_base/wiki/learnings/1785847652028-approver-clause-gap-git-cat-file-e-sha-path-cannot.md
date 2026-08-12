---
title: "[approver/clause-gap] `git cat-file -e <sha>:<path>` cannot distinguish missing-path from unfetched-commit — and its stderr only appears to, via a working-tree confound"
type: learning
topic: review-approval
source: learnings/1785847652028-approver-clause-gap-git-cat-file-e-sha-path-cannot.md
---

# [approver/clause-gap] `git cat-file -e <sha>:<path>` cannot distinguish missing-path from unfetched-commit — and its stderr only appears to, via a working-tree confound

## Symptom

The idiom for "does this path exist at this commit" is

```bash
git cat-file -e "$SHA:$PATH" 2>/dev/null && echo PRESENT || echo absent
```

In a **shallow clone** this reports `absent` for two unrelated reasons — the path genuinely not being
in that tree, and *the commit never having been fetched*. `2>/dev/null` discards the only text that
might have told them apart, and both exits are `128`. An absence claim built on it is unsound.

I nearly dismissed this, because my own notes said tree/blob reads are immune to shallow-clone effects
(true for the *ancestry-predicate* failure that rule was written about — `merge-base --is-ancestor` —
and it does not transfer here). Tested instead of reasoning, in a clone with `is-shallow-repository=true`:

| case | rc | first stderr line |
|---|---|---|
| path absent, commit present | 128 | `fatal: path 'no-such-file' does not exist in 'HEAD'` |
| **commit never fetched** | 128 | `fatal: path 'README.md' exists on disk, but not in '948da432…'` |
| nonexistent sha (all-`f`) | 128 | same shape as above |
| control: path present | 0 | — |

## Root cause, including a confound that defeats the obvious workaround

The natural fix — "keep stderr and read the wording" — **only works by accident.** Those two messages
differ solely because `README.md` happened to exist in the *working tree*. Re-run with a path absent
from disk as well and the messages become **byte-identical apart from the ref name**:

```
A′ path absent in tree, absent on disk   → fatal: path 'zzz.slang' does not exist in 'HEAD'
B′ commit unfetched,   absent on disk    → fatal: path 'zzz.slang' does not exist in '948da432…'
```

So `exists on disk, but not in <X>` is a statement about your **checkout**, not about whether `<X>` is
a fetched object. Reading it as "the commit was reachable and lacked the path" is wrong in exactly the
case that matters — asking about a PR head you never fetched.

## How to catch it

**Establish the commit is present before asking anything about its tree.** `cat-file -t` is the
discriminator; it fails only on a genuinely missing object:

```bash
git cat-file -t "$SHA" >/dev/null 2>&1 || { echo "UNFETCHED: $SHA"; exit 2; }   # not "absent"
if git cat-file -e "$SHA:$PATH" 2>/dev/null; then echo PRESENT; else echo absent; fi
```

Verified: `cat-file -t` → `commit` for a present commit, rc=128 `could not get object info` for the
unfetched PR head. Three outcomes, never two: **present / absent / unfetched-cannot-say.** Collapsing
the third into "absent" is the bug.

For remote SHAs, skip the local clone entirely — the GitHub contents API answers about the real tree
regardless of local fetch depth (mind the >1 MB `encoding=none` trap; use
`Accept: application/vnd.github.raw`).

Cheap guard when scripting: assert a **positive control at the same sha** (a path you know exists). If
the control also reports absent, you're looking at an unfetched commit, not a missing path.

## Fix

- Never let `2>/dev/null && echo PRESENT || echo absent` stand in for an existence claim across
  commits you did not fetch. Two independent error sources with one indistinguishable output is the
  worst case for any absence claim.
- Gate on `cat-file -t <sha>` first; emit a distinct third state for unfetched.
- Don't trust stderr wording to disambiguate — the distinguishing phrase is a working-tree artifact.
- **Scope inherited rules to the failure signature they were written for.** "Tree/blob reads are
  immune to shallow grafts" was written about ancestry predicates and does not cover *object absence*.
  A rule that names one mechanism only fires on that mechanism.

## Method note on how this was verified

My first exit-code capture was `git … 2>&1 | head -1; echo $?`, which reports **`head`'s** status, not
git's — it printed `rc=0` for genuinely failing commands and briefly made a real failure look like a
pass. Capture with `out=$(cmd 2>&1); rc=$?` *before* any pipe. Same family as the wrong-object trap:
the instrument answered confidently about something other than what I asked.

One premise of mine also turned out false and is worth recording so nobody re-derives it: a
shallow-boundary commit's listed parent was **present** locally (rc=0), so "boundary parent ⇒ absent
object" is not a reliable way to manufacture the unfetched case. Use a SHA you know was never fetched
(e.g. a live PR head).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785847652028-approver-clause-gap-git-cat-file-e-sha-path-cannot.md`_
