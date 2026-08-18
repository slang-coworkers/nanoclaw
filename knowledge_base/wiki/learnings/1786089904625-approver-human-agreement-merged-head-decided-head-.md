---
title: "[approver/human-agreement] merged head != decided head: stamp SUPERSEDED even when the delta is provably non-behavioral"
type: learning
topic: review-approval
source: learnings/1786089904625-approver-human-agreement-merged-head-decided-head-.md
---

# [approver/human-agreement] merged head != decided head: stamp SUPERSEDED even when the delta is provably non-behavioral

## Symptom

slang#12127 merged 2026-08-07 with a `github.pr_merged` webhook. My row was `WOULD_APPROVE @f4a191c1`. The PR merged at `51df4602` — a second commit landed 2026-08-05, three weeks after my decision. Naive join = stamp my row APPROVED and call it a vindicated approve.

## Root cause of the near-error

The delta `f4a191c1..51df4602` is **provably non-behavioral**: `git diff -w --ignore-blank-lines ... | grep -v '^[+-]\s*//'` reduces to a pure identifier rename (`storedType` → `pointeeType`, 3 sites incl. the `SLANG_RELEASE_ASSERT`), plus two explanatory comments and one added FileCheck line. Zero semantic change. The pull to round up to "clean agreement, byte-identical" is strong *because the substance really is identical*.

But my own pre-registered join criterion on the row said: **"merge unchanged @ this head ⇒ agreement (APPROVED-equiv)"**. The head *moved*. So the row is `SUPERSEDED_BY_LATER_REVISION`, and the merged head — which I never decided — gets its own row.

## The rule

**A behaviorally-identical delta still moves the head ⇒ the row is SUPERSEDED, not an agreement.** These are two separate facts and both belong in the record:
1. *Row status*: superseded (the head I decided is not the head that merged).
2. *Substantive calibration*: the approve direction was vindicated — behaviorally-identical code merged with an explicit human MEMBER `APPROVED`.

Collapsing (2) into (1) manufactures a byte-identical agreement that never happened. Reporting only (1) throws away real calibration signal. Precedent for the two-row shape: #12117 (R1 superseded + R2 agreement).

## How to catch it

On every `pr_merged` join, before stamping: `gh pr view N --json headRefOid,mergedAt,mergeCommit,commits` and compare `headRefOid` to the SHA on your row. If they differ, enumerate the commits and diff decided..merged. **Honour the criterion you pre-registered on the row** — it was written before you knew the outcome, which is exactly why it outranks your post-hoc read of the diff.

## Second signal: the author self-addressed all three findings I cleared as advisory

My challenger cleared 3 findings advisory. The author's follow-up commit fixed **all three**, and my clearing text had named the missing artifact precisely — I wrote *"only the exact `-disasm store.8` pin is missing"*, and the author added exactly `// BC: store.8 {{.*}}, str:"y2"`.

Read this correctly: **not a false-safe** (no CHANGES_REQUESTED; merged; human approved; nothing I cleared was wrong). It is evidence that "advisory" was the right *severity* and the findings were *real* — the useful calibration is that naming the exact missing artifact in the clearing rationale is what let the author close it in one pass. Keep doing that; it converts a cleared finding into actionable author feedback without inflating it to a blocker.

The one finding that survived to the merged head — the bot's 🔵 on `SLANG_RELEASE_ASSERT` reachability being "asserted but not proven/documented" — was re-flagged at `51df4602` and a human MEMBER approved anyway. My challenger's clearing of it (fail-LOUD direction, 4 sibling arms already use the same helper unguarded on store-destination ptr types) was upheld.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786089904625-approver-human-agreement-merged-head-decided-head-.md`_
