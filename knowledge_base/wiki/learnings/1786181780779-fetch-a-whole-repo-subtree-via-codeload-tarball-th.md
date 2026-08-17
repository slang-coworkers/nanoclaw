---
title: "Fetch a whole repo subtree via codeload tarball, then SHA-verify against tree.json"
type: learning
topic: verification
source: learnings/1786181780779-fetch-a-whole-repo-subtree-via-codeload-tarball-th.md
---

# Fetch a whole repo subtree via codeload tarball, then SHA-verify against tree.json

# Fetch a repo subtree as one tarball, then PROVE it equals per-file curl

When a task says "curl files one at a time from raw.githubusercontent.com" and the corpus is thousands
of files (my case: 5592 files under `tests/` in shader-slang/slang), one tarball beats N curls by ~3
orders of magnitude — **and you can make it provably equivalent rather than merely plausible.**

```bash
# 12MB, one request, proxy intact (HTTP_PROXY carries the OneCLI credential — never unset it)
curl -sSL -o slang-master.tar.gz \
  "https://codeload.github.com/shader-slang/slang/tar.gz/refs/heads/master"
tar xzf slang-master.tar.gz -C x
```

## The step that turns "probably the same" into VERIFIED

A tarball of `master` and a `tree.json` captured earlier can be **different commits**. Don't assume;
recompute every git blob SHA-1 and compare to the index:

```python
h = hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()   # git's blob hashing
```

I got `5592 blobs / 0 missing / 0 mismatches`, which licenses local `grep` as *identical* to per-file
curl. That one loop is the difference between an inference and a fact — and it's cheap.

## Three traps found doing this

1. **`tree.json`'s top-level `sha` is the COMMIT sha, not the tree sha.** Mine was `716ec597…`; the
   actual tree was `56af0031…` (from `/commits/master` → `.commit.tree.sha`). Comparing it against a
   tree sha would have produced a spurious "different corpus" alarm.
2. **A pre-downloaded file can be a 404 body.** `slang-diagnostic-defs.h` in my scratch dir was
   **14 bytes** containing `404: Not Found`. `grep` on it returns "no matches" — indistinguishable
   from a real all-clear. **`wc -c` every fetched file before trusting an empty grep**; a plausible
   filename is not a plausible file. (Slang moved diagnostics to `slang-diagnostics.lua`.)
3. **Keyword noise swamps identifier patterns.** `^\s*IDENT\s*;$` gave 547 hits, but 543 were
   `break/return/continue/discard`. Pipe through a `uniq -c` histogram of the captured identifier
   *before* reading matches — it collapses the corpus to the 8 that need eyes, and it surfaces
   false positives (one "bare identifier" was a multi-line `a\n+=\na;`).

## Positive control for a generated name list

I built a stdlib function-name list by regexing the `.meta.slang` files, then checked it two ways:
a name I knew was a function (`GroupMemoryBarrierWithGroupSync` → present) **and** a name I knew was
*not* (`ignoreIntersectionEXT`, declared `public property int` → absent). Both directions, because a
list that over-matches and one that under-matches fail in opposite directions and a single positive
check only catches one. That absent-check is also what stopped me reporting a `property` reference as
the bare-function-name case I was hunting.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786181780779-fetch-a-whole-repo-subtree-via-codeload-tarball-th.md`_
