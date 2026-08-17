---
title: "[approver/human-disagreement] An author's WIP declaration is evidence about who wants to look, not about what they'd find — abstain refuted by a merge of byte-identical code"
type: learning
topic: review-approval
source: learnings/1786346987860-approver-human-disagreement-an-author-s-wip-declar.md
---

# [approver/human-disagreement] An author's WIP declaration is evidence about who wants to look, not about what they'd find — abstain refuted by a merge of byte-identical code

# "The author isn't ready for review" ≠ "the code isn't ready to merge"

**Outcome.** I recorded `ABSTAIN_POLICY (CHALLENGER_CONCERN)` on slang-rhi#811 at head
`2a3524d8` while **every artifact said approve**: 6/6 eligibility clauses passed, CI was
fully green with all four wrapper-bearing Debug legs executing the regression test across
7 backends, CodeRabbit was clean on the pinned head, zero 🔴 findings, both nits cleared.

I held it on one signal: the author had commented *"Removed review requests for now. Work
in progress."* and removed **both** human reviewers 45 seconds earlier.

**Five days later a maintainer approved and merged it.** Independent, not a self-merge
(`mergedBy=skallweitNV`, `author=jvepsalainen-nv`, `reviewDecision=APPROVED`).

## The measurement that makes this a clean loss

`sha256` per file, my decided head vs the merged head:

| file | result |
|---|---|
| `src/device.cpp` | **IDENTICAL** |
| `src/device.h` | **IDENTICAL** |
| the PR's test file | changed by **+1 line** |

`compare` showed `ahead_by 6`, but **5 of 6 commits were unrelated PRs merged in from
main**. The only commit touching this PR's own code added exactly:

```cpp
+    REQUIRE(secondShaderObject != nullptr);
```

— a review-bot nit I had already examined and **correctly cleared as advisory**. So the
production fix shipped **byte-identical** to what I declined to approve.

⚠️ **Score it against the falsifiable reading.** *"A human must look; a human looked"*
scores every abstain as correct no matter what happens — a self-sealing frame. The
falsifiable claim an abstain actually makes is **"this revision is not material enough to
merge as-is,"** and a clean maintainer approval of byte-identical code **refutes** it.
This is a **loss**, not a vindication.

## Root cause: a scope error, not a perception error

The WIP observation was **correct**. The author did say it, did pull both reviewers, and
did keep pushing for days afterward. Nothing about reading the signal was wrong.

The **inference** was wrong: ⭐⭐⭐ **I collapsed a claim about the AUTHOR'S PROCESS into a
claim about the ARTIFACT.** A WIP declaration tells you *who wants to look and when* — it
carries almost no information about *what they would find*. The maintainer merging
untouched production code five days later is the strongest available evidence the artifact
was ready the entire time.

## What I would keep, and the boundary

I do **not** retract holding *something* back. A `WOULD_APPROVE` on a PR whose author had
*just* asked people to stop reviewing would have been presumptuous, and that head did later
accumulate commits.

⇒ **The defect was the reason_code's SCOPE, not the decision to flag.** The honest
alternative was **`WOULD_APPROVE` with the WIP recorded as a caveat for the human** — which
is precisely what the maintainer did with the same facts.

⭐⭐⭐ **Operational rule: when the ONLY thing standing between a clean artifact and
approval is a statement about the author's INTENT, put that statement in the report and let
the verdict follow the CODE.** Author-intent signals belong in the narrative, not in the
verdict.

## Two smaller findings worth carrying

- ⭐⭐ **A correctly-cleared nit is still worth reporting.** I cleared the
  `secondShaderObject != nullptr` gap as trigger-unreachable and test-strength-only — that
  judgment was right, it didn't gate — and the author fixed it within a day of my recording
  it. *"Does not block" ≠ "not worth saying."*
- ⚠️ **Join against the head each ROW was decided at, never the merged head.** The
  `pr_merged` webhook carried a `head_sha` matching **neither** of my decided revisions
  (main had been merged in twice since). Two `record_human_verdict` calls, one per decided
  sha. (Also: `gh pr view --json merged` does not exist — the fields are
  `state`/`mergedAt`.)

## Calibration context

This is now the third refuted abstain on this repo against one vindication (#802 vindicated;
#814 and #811 refuted), alongside a separately-measured 4-for-4 over-conservative streak.
⇒ **When the losses cluster on the same side, the bar is the defect, not the PRs.** An
approver that never approves has no measurable precision — only a shrinking claim to
usefulness.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786346987860-approver-human-disagreement-an-author-s-wip-declar.md`_
