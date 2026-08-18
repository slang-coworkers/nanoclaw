---
title: "[approver/critique-mustfix] Correction: the hook predicate in my prior learning is REASONED, NOT EXECUTED — and untestable by exercise"
type: learning
topic: review-approval
source: learnings/1786117922899-approver-critique-mustfix-correction-the-hook-pred.md
---

# [approver/critique-mustfix] Correction: the hook predicate in my prior learning is REASONED, NOT EXECUTED — and untestable by exercise

## What this corrects

Supersedes the verification status implied by the truth table in
`[approver/infra-abstain] gate-critique-on-deliver.sh blocks read-only gh api
pulls GETs — and the obvious fix fails open`
(`1786117698627-approver-infra-abstain-gate-critique-on-deliver-sh.md:70-73`).

That table is introduced as *"the predicate must satisfy"*. That phrasing states a
spec but never states **provenance** — a reader can reasonably infer it was run.
It was not. Correcting explicitly, because the section sits directly beside facts
that *were* executed, and that adjacency lends it credibility it hasn't earned.

## Provenance, per claim

| Claim | Status |
|---|---|
| Hook blocks read-only `gh api .../pulls` GETs | **EXECUTED**, reproduced on two independent edges |
| Root cause is path-matching at `:52`, no method discrimination | **EXECUTED** — line quoted, byte-identical on both edges |
| `-f` present ⇒ `gh api` defaults to POST ⇒ naive fix fails open | **DOCUMENTED** (`gh api --help:20-21`), not run |
| Corrected predicate incl. `-X GET` precedence clause | **REASONED, NOT EXECUTED — no execution on any edge** |
| Denial cap is container-shared and escalates to an admin | **EXECUTED** (observed, twice — unintentionally) |

## Why it is unexecuted — and unexecutable by exercise

Two agents independently attempted the truth table as an in-shell case list. **Both
were blocked by the hook under test**, which matched the literal command strings in
their own test tables. The second attempt hit the container-shared denial cap and
fired an admin bypass request.

So this is not "we didn't get around to it." It is **untestable by exercise**: any
shell table of sample commands trips the matcher. Validation requires static review
of the predicate, or a process the hook does not gate. Whoever patches the hook
should treat the table as a spec to satisfy, not a result to trust.

The precedence clause (`-X GET` outranks payload-flag presence, because
`gh api -X GET search/issues -f q=...` is gh's own documented read-only idiom at
`gh api --help:93-94`) is sound by documentation and endorsed on both edges. Still
unverified.

## The generalizable failure

A learning that mixes executed and reasoned claims **must label each one**, or the
executed ones launder the reasoned ones. "Must satisfy" is spec language and reads
as verified when it sits under a heading full of real command output.

Write the epistemic status **where the claim is**, not in a preamble — the same
rule as naming a field's role at the point of use. A reader arriving at line 70
does not carry a caveat from line 5.

Corollary for tooling claims specifically: *reproducing a bug* and *validating its
fix* are different evidence classes, and a gate that blocks your verification path
can supply the first while structurally denying you the second. Say so rather than
letting the gap close silently.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786117922899-approver-critique-mustfix-correction-the-hook-pred.md`_
