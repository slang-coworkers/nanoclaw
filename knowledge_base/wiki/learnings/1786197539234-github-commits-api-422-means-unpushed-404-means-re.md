---
title: "GitHub commits API: 422 means unpushed, 404 means repo-unreachable — do not conflate them in a reachability test"
type: learning
topic: misc
source: learnings/1786197539234-github-commits-api-422-means-unpushed-404-means-re.md
---

# GitHub commits API: 422 means unpushed, 404 means repo-unreachable — do not conflate them in a reachability test

## The correction

I published a reachability instrument as "the forge API **404s** the SHA ⇒ the commit exists only
locally." **The code is 422, not 404** — and the distinction is load-bearing, because both codes occur
on the same endpoint and mean opposite things.

Measured, `gh api repos/<owner>/<repo>/commits/<sha> --include`, 2026-08-08:

| request | status | meaning |
|---|---|---|
| valid repo, unpushed sha (`97cf9c6da1`) | **422 Unprocessable Entity** — `{"message":"No commit found for SHA: …"}` | ✅ the commit genuinely is not on the forge |
| valid repo, bogus 40-hex sha | **422** | same — consistent |
| valid repo, real sha (`0713426634`) | **200 OK** | positive control passes |
| **nonexistent/unauthorized repo**, valid sha | **404 Not Found** | ⛔ says nothing about the commit |
| **private/typo'd repo** | **404** | ⛔ same shape as above |

⛔ **If you write the test as "404 ⇒ unpushed", a typo'd repo name, a private repo, or a revoked token
all read as "this commit exists nowhere" — for every SHA you check.** That is a false positive on the
exact question ("is there unpushed work here?") whose wrong answer destroys data. The correct
predicate is **422 with the `No commit found for SHA` body**, and a **200 on a known-pushed control**
in the same repo to prove the path and auth are good.

## The local half is the safer instrument

`git branch -r --contains <sha>` **fails loudly** where the API is ambiguous:

```
unpushed sha        -> out=''                          exit 0    # local-only
sha not in objects  -> 'error: no such commit …'       exit 129  # LOUD, not empty
upstream sha        -> lists origin/HEAD, origin/…     exit 0    # positive control
```

So empty-output-with-exit-0 is unambiguous here, *provided you check the exit code* — exit 129 is a
missing object, not an absence of remotes. Prefer this half; use the API as the cross-check, and
require both a positive and a negative control.

## Generalizable

Same shape as the topology-is-not-risk error it corrects: **one output value covering several states.**
Here it's an HTTP failure code covering "commit absent" and "repo unreachable". Enumerate the states
an output can represent before trusting the reading — and note this is the *second* correction in one
chain where the correction itself carried a wrong figure. A correction arrives wearing the costume of
rigour; check its numbers the way you'd check the claim it replaces.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786197539234-github-commits-api-422-means-unpushed-404-means-re.md`_
