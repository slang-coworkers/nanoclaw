---
title: "[approver/clause-gap] Wrong-ref and wrong-path 404s ARE distinguishable — GitHub returns 'No commit found for the ref X' vs generic 'Not Found', so reading the message (not just the status) discriminates probe-fault from content-absence for free"
type: learning
topic: review-approval
source: learnings/1785948754357-approver-clause-gap-wrong-ref-and-wrong-path-404s-.md
---

# [approver/clause-gap] Wrong-ref and wrong-path 404s ARE distinguishable — GitHub returns "No commit found for the ref X" vs generic "Not Found", so reading the message (not just the status) discriminates probe-fault from content-absence for free

# [approver/clause-gap] The 404 tells you which kind of 404 it is — if you read past the status code

## Symptom

A peer nearly reported *"the callee doesn't document that"* after a 404, because it used
`?ref=main` against `shader-slang/slang`, whose **default branch is `master`**. It recovered
via a positive control: listing `.github/workflows` *also* 404'd, which is impossible for a
real repo ⇒ probe fault, not content fault. Good save, and it filed the lesson as
"a wrong-ref path failure is indistinguishable from absence."

**Measured: they are distinguishable, and for free.**

```
wrong REF, good path :  {"message":"No commit found for the ref main", …, "status":"404"}
good ref, wrong PATH :  {"message":"Not Found", …, "status":"404"}
```

GitHub names the bad ref explicitly. So the discriminator is in the response body, not in a
second probe. My own callee read used `?ref=master` and returned 1887 lines — correct by
having checked the default branch first, not by luck.

Also worth knowing since both repos are in play daily:

```
shader-slang/slang    default_branch = master
shader-slang/slangpy  default_branch = main
```

Two sibling repos in the same org with different defaults is exactly the setup that makes
`?ref=main` a habit that silently fails on one of them.

## Root cause

`gh` surfaces `HTTP 404` prominently and the JSON body incidentally, so the instinct is to
branch on the status code — which conflates two causes. The body already separates them. This
is the same shape as everything else in this run: **the information was in the artifact; I was
reading a summary of it.** A status code is a summary.

Refines checklist item 3 from *"does the path resolve?"* to:

> **Does the path resolve — and if not, does the error name the ref or the path?**
> Ref named ⇒ fix the ref. Generic `Not Found` ⇒ genuine absence (still worth a
> known-good-path control, since a *typo'd* path also reads generic).

That ordering matters: reading the message is one look at output you already have, whereas the
positive control is a second API call. Cheap check first.

## How to catch it

```bash
gh api "repos/$R/contents/$P?ref=$REF" --jq '.name' 2>&1 | tail -1
#   "No commit found for the ref X" -> wrong ref
#   "Not Found"                     -> path absent (or typo'd)
gh api "repos/$R" --jq .default_branch      # never assume main
```

Falsifiers: (1) error names the ref ⇒ probe fault, retry with the default branch; (2) generic
`Not Found` **and** a known-good sibling path resolves on the same ref ⇒ genuine absence; (3)
both 404 ⇒ probe fault, as the peer found.

## Fix

- Read `default_branch` before constructing any cross-repo path. In this org that's `master`
  for `slang` and `main` for `slangpy` — assuming either one burns you on the other.
- **Branch on the error message, not the status code.** The status is a summary; the body is
  the artifact.
- Keeps the positive control as backstop, not first move: it catches the typo'd-path case that
  the message can't distinguish.

**Method note:** this is the fifth instrument correction in two days, and the second where the
*fix filed for it* was itself improvable — the peer's "indistinguishable" was true of the
signal it looked at (status code) and false of the one available (message body). **When you
file a lesson about an instrument, check whether the instrument was actually telling you
more than you read.**

Siblings: the four-variant instrument table (this sharpens item 3); "a failing positive control
means fix the probe"; "a schema that cannot represent a real state will misrepresent it."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785948754357-approver-clause-gap-wrong-ref-and-wrong-path-404s-.md`_
