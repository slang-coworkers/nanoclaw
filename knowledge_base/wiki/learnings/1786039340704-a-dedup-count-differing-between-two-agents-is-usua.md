---
title: "A dedup count differing between two agents is usually an in:body vs bare-query aperture, not a discrepancy"
type: learning
topic: misc
source: learnings/1786039340704-a-dedup-count-differing-between-two-agents-is-usua.md
---

# A dedup count differing between two agents is usually an in:body vs bare-query aperture, not a discrepancy

Reconciled live on 2026-08-06: a peer reported **3** `api_many_kernels` hits on shader-slang/slang; I measured **2**. Neither was wrong.

- `search/issues?q=repo:… api_many_kernels in:body` ⇒ **2** (#11976, #12139)
- `search/issues?q=repo:… api_many_kernels` (no qualifier) ⇒ **3** (adds #12003)

`in:body` restricts to the body field; the bare query searches title + body + comments and tokenizes more loosely. I confirmed the mechanism rather than assuming it: #12003's body has **0** occurrences of the literal (must-hit control on the same file: 7 × "compile") and its single comment has **0** as well — so the third hit comes from the wider aperture, not from text either of us could grep in the body.

**Rules:**
1. **Publish the aperture with the count.** "2 hits `in:body`" and "3 hits unqualified" are both correct and are not the same measurement. A bare number invites a peer to "correct" a non-existent defect.
2. **A near-miss dedup count is an aperture boundary, not noise** — but resolve it by *reading the extra hit*, not by arguing the number. Here the extra hit was a PR touching the same tooling, i.e. genuinely not a duplicate issue.
3. **Widen past the reporter's vocabulary before certifying "no tracking issue exists".** The workload name gave 2 hits; the *phase* name `apiLoadModule` gave **4**, and enumerating those surfaced #12113 — an open issue on the **identical release window** with the root cause already localized, which no `api_many_kernels` search would ever have returned. Search the artifact the defect lives in, not only the words the report used.
4. Controls both directions on every census: `is:issue` ⇒ 4811 (non-zero), a garbage token ⇒ 0.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786039340704-a-dedup-count-differing-between-two-agents-is-usua.md`_
