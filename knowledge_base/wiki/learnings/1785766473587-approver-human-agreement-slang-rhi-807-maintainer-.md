---
title: "[approver/human-agreement] slang-rhi#807 — maintainer self-merge with a fresh independent APPROVE that predated the finding by 19s; ABSTAIN scored as conservative agreement"
type: learning
topic: review-approval
source: learnings/1785766473587-approver-human-agreement-slang-rhi-807-maintainer-.md
---

# [approver/human-agreement] slang-rhi#807 — maintainer self-merge with a fresh independent APPROVE that predated the finding by 19s; ABSTAIN scored as conservative agreement

## Symptom

slang-rhi#807 ("Temporarily disable metallib_4_0 capability", skallweitNV)
merged ~6 minutes **before** my ABSTAIN_POLICY/`OPEN_GAP` verdict arrived.
Shadow mode, so nothing was posted or blocked — but the join still has to be
scored, and the interesting part is *how* the human approval was obtained.

## Root cause / what the timeline showed

From `issues/807/timeline` (the `/pulls/` GET is hook-blocked; timeline carries
the same review rows):

```
reviewed | ccummingsNV      | 13:23:29Z | 2f272bdc2984 | dismissed
reviewed | tdavidovicNV     | 13:24:15Z | 2f272bdc2984 | dismissed
review_dismissed | skallweitNV | 13:26:39Z (x2)
reviewed | ccummingsNV      | 13:29:00Z | dc03b871afb3 | approved
reviewed | coderabbitai[bot]| 13:29:19Z | dc03b871afb3 | commented   <- 19s LATER
merged   | skallweitNV      | 13:46:38Z | 14e2f74e2e19
```

**The approval predates the finding by 19 seconds.** So the human APPROVE cannot
have considered CodeRabbit's gap — the sequence is invisible in GitHub's UI,
which renders both as "on this commit" with no ordering cue.

## How to catch it

1. **Never infer "a human considered finding X" from "a human approved."**
   Compare `submitted_at` timestamps between the approval and every finding at
   the same SHA. Same-SHA is necessary but nowhere near sufficient; sub-minute
   ordering is common when a bot re-reviews on a fresh push.
2. **Score the join against the byte content, not the line totals.** The squash
   commit's `+8/-3` matched my recorded diff — but I confirmed the join properly
   by sha256-ing both changed files at the decided head vs the merge commit
   (`compare` also showed `ahead_by 1 / behind_by 2`, which alone would *not*
   have proven identity). Both `IDENTICAL` → the join lands on the decided head
   exactly. Cheap, and it converts "probably the same" into a fact.
3. Fetch reviews from `issues/<n>/timeline` when `pulls/<n>/reviews` is
   unavailable — same rows, `state` + `submitted_at` + `commit_id` included.

## Fix / calibration

Recorded `human_verdict=APPROVED` @`dc03b871`. **This is conservative agreement,
not a false-safe** — the do-not-round-up class, same as #12142 and #804.

The severity premise I had recorded as *unresolvable* (runner macOS version) was
later resolved from the public job log: `Image: macos-26-arm64`, macOS 26.5.2
→ the deleted `CHECK_FALSE` **was** load-bearing, not cosmetic. So the hold was
substantively right and is now evidenced rather than merely lucky. See
`[approver/infra-abstain] GitHub Actions job logs are PUBLIC`.

Standing pattern (now 7 slang-rhi rows): the approver has still never approved a
Metal-only slang-rhi change, and every hold has been on coverage/assertion
grounds. None contradicted yet — but note this one merged anyway with an
independent APPROVE, so the class is "maintainers accept temporary
test-disables at LOW severity," not "the holds are wrong."

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785766473587-approver-human-agreement-slang-rhi-807-maintainer-.md`_
