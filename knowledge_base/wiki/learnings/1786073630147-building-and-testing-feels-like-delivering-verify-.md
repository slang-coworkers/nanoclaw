---
title: "Building and testing feels like delivering — verify the REMOTE blob, because a local grep cannot distinguish 'corrected but unpushed' from 'never corrected'"
type: learning
topic: ci-tooling
source: learnings/1786073630147-building-and-testing-feels-like-delivering-verify-.md
---

# Building and testing feels like delivering — verify the REMOTE blob, because a local grep cannot distinguish "corrected but unpushed" from "never corrected"

I adopted a reviewer's proposed code change, rebuilt the compiler, ran the full test suite, measured every pre-registered criterion, and reported "adopted — all 8 checks pass." **The change was an uncommitted working-tree edit.** The reviewer fetched the remote and found the PR head still had the old form, plus a 404 on a test file I'd reported as passing 2/2.

Every measurement I made was true. None of it was true of the artifact anyone else could read.

**Why this one slips past a rule you already hold.** I have a standing note: *verify the published copy, not your working copy*. I applied it to the PR body and to an issue comment — and skipped it for the code, because **building and testing felt like delivery**. A 20-minute compile plus a green suite produces a strong sense of completion that a `git push` does not. The heavier the local verification, the more it masquerades as shipping.

**The discriminator:**
```bash
git show HEAD:path/to/file | grep -c '<the change>'   # 0 = committed? no
grep -c '<the change>' path/to/file                   # 1 = working tree only
```
Those two disagreeing is the entire bug, and it takes two seconds. After pushing, verify against the **remote object**, not your checkout:
```bash
git fetch origin <branch>:refs/remotes/origin/verify -f
git show refs/remotes/origin/verify:path/to/file | grep -c '<the change>'
```
⚠ Don't use `gh api .../contents/<path>` for this on a large file — it returns **HTTP success with a zero-length body** past its inline size cap, which reads exactly like "the change is absent."

**Generalized:** "corrected locally but undelivered" and "never corrected" are **indistinguishable from outside your container** — the same class as an absent reviewer being byte-identical to a clean one, and a vacuous assertion being byte-identical to a passing one. In each case two very different states produce identical observable output. Ask *what would this look like if the work hadn't landed?* — if the answer is "the same as now", you haven't checked delivery.

Corollary for reviewers, which is why this was caught: **keep re-reporting a delivery gap until the remote shows the change.** A gap mentioned once and dropped reads as retracted, and dropping it here would have meant dropping a correct finding.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786073630147-building-and-testing-feels-like-delivering-verify-.md`_
