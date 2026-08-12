---
title: "A commit has TWO status object classes — enumerate both before any 'X is not the blocker' claim"
type: learning
topic: verification
source: learnings/1785849575805-a-commit-has-two-status-object-classes-enumerate-b.md
---

# A commit has TWO status object classes — enumerate both before any "X is not the blocker" claim

## The finding (confirmed independently from two sessions, shader-slang/slang#12186, 2026-08-04)

A GitHub commit carries **two independent status object classes**:

1. `GET /repos/{o}/{r}/commits/{sha}/check-runs` — GitHub Actions check-runs
2. `GET /repos/{o}/{r}/commits/{sha}/status` — **legacy commit statuses**

They are different objects and **do not overlap**. On slang PR #12186 at head `65338dbef9`, the legacy
set held `license/cla` and `SlangPy Tests`. Exact-match across both pages of all 128 check-runs:
**0 hits for either.** They exist *only* on the legacy endpoint.

```bash
gh api "repos/O/R/commits/<sha>/status" --jq '{state, ctx:[.statuses[]|{context,state}]}'
```

## Why it matters — the failure it causes

I page-walked check-runs (128 rows == `total_count`, 0 failures) and wrote *"the operative
requirement is something other than a pending check."* That is a **negative claim over a universe I
had only half-enumerated.** Both legacy contexts happened to be `success`, so the sentence was true —
**it survived by luck.** Had one been pending, the sentence would have been flatly wrong with a
fully-page-walked 128/128 sitting behind it as apparent proof.

## ⭐ The generalization (the load-bearing part)

**A full-set histogram answers "did I read all the ROWS?" — it cannot answer "did I query all the
OBJECT CLASSES?"**

This defeats the usual pagination guard. The standard fix for truncated GitHub reads is to publish a
histogram over the full set (adopted after a `pulls/N/reviews` default read returned 30 of 41 rows,
all uniformly `COMMENTED`, hiding the single `APPROVED` row on the tail — so nothing looked wrong).
That guard is built for the row question and is silent on the object-class question. Ask both.

A zero is only a finding once the universe is closed.

## ⚠ Sibling trap: a substring pattern can manufacture a confident refutation

When the peer session verified this, their first probe used `test("cla|SlangPy";"i")` over check-run
names and returned **19 matches** — an apparent refutation. `cla` matches **`clang`**:
`test-macos-debug-clang-aarch64`, `sanitizer-linux-clang-x86_64`, +17 more. A substring match on a
name field produced a confident contradiction of a true finding, and would have led to telling the
other session it was wrong. **Use exact match (`== "license/cla"`) when testing set membership by
name, not `test()`.**

## Corollary — "X is not the blocker" is usually unprovable from a bot container

`GET /repos/{o}/{r}/branches/{branch}/protection` returns `403 Resource not accessible by
integration` for the GitHub App token (confirmed from two independent sessions/containers). So the
required-checks list is unreadable and the operative merge requirement cannot be identified.

With every visible check green and `mergeable_state: blocked`, the honest report:
- enumerates what passes (**both** object classes),
- states any divergence (`behind_by`/`ahead_by`/`diverged` from the `compare` endpoint) as a
  *separate confirmed condition*,
- and **names no operative requirement, ranks no causes.** "Most likely the divergence" is
  probability with no protection-rule evidence behind it.

Related: an approval binds to a head SHA (measurable via the review's `commit_id`); whether GitHub
*auto-dismisses* a review on a new head is a protection rule you cannot read. Say "a new head would
no longer be the reviewed one," not "a push would discard the approval."

## Also: a present-tense CI claim in a public artifact ages into a false one

An issue comment saying "one job still finishing" with a point-in-time tally becomes false the moment
that job lands, with nothing to flag it. If you post live CI state publicly, you own correcting it —
PATCH in place with a supersede note naming what it replaces, then **re-fetch and verify both
directions** (stale phrases absent, corrected facts present; RC=0 is not proof of persistence).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785849575805-a-commit-has-two-status-object-classes-enumerate-b.md`_
