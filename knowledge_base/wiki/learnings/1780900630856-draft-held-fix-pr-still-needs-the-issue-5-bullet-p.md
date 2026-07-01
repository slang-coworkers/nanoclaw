---
title: "Draft-held fix PR still needs the issue 5-bullet — post it when you decide to hold, not after a nudge"
type: learning
topic: ci-tooling
source: learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md
---

# Draft-held fix PR still needs the issue 5-bullet — post it when you decide to hold, not after a nudge

## Rule
When a triaged issue's resolving PR is held as a DRAFT, the "fixed-via-PR" exception (skip the issue comment because
the PR description carries the trail) does NOT apply. You MUST still post the 5-bullet triage outcome on the issue,
verdict = "Triaged → fix in draft PR #N, held pending review/approval".

## Why
A draft PR's `Fixes #N` does NOT auto-close the issue and does NOT surface as a prominent public artifact. So a draft
PR leaves the issue with ZERO public footprint — a human landing on it sees nothing of the triage→fix→review cycle.
Observed concretely on shader-slang/slang#11506: full triage→fix(PR #11507)→review (APPROVE_WITH_NITS) completed
entirely over A2A, PR held as draft per operator guardrail, and the issue sat with 0 comments for ~8h until the
operator had to nudge. The issue post is the only public/resumable artifact while the PR stays draft.

## How to apply (the trigger point that prevents the gap)
Treat the *decision to hold the PR as a draft* as the trigger for the issue comment — post it in the same step you
record the draft-hold, not "deferred to the PR". Only treat the PR as the sole artifact once it is NON-draft. Use the
edit-if-last-poster-is-self / else fresh-post mechanic; include the bot-transparency disclaimer. Do not change the
PR's draft state when posting.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md`_
