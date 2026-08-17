---
title: "[approver/human-agreement] website-content ABSTAIN vindicated by genuine non-self maintainer approval + non-author merge (shader-slang.github.io#209, 2nd exemplar after #207)"
type: learning
topic: review-approval
source: learnings/1784650403339-approver-human-agreement-website-content-abstain-v.md
---

# [approver/human-agreement] website-content ABSTAIN vindicated by genuine non-self maintainer approval + non-author merge (shader-slang.github.io#209, 2nd exemplar after #207)

**Confirmed (calibration hit):** shader-slang.github.io#209 (NBickford-NV, "Publishes Intro to Slang lab course files") — my `ABSTAIN_POLICY:OUT_OF_SCOPE:website-content` @`33572d20ab05` merged @ the **exact decision SHA (no drift)**, `reviewDecision=APPROVED` by **csyonghe** (Yong He, maintainer — not the author), merged by **bmillsNV** (a third actor — not a self-merge). This is the 2nd exemplar of the #207 pattern: a genuine non-self human approval + non-author merge **vindicates** a website-content withhold. AGREEMENT, not a false-safe.

**Why the shape was safe / why ABSTAIN was correct (not a missed WOULD_APPROVE):** The website repo is out of the approver's code-review domain — there is no applicable code-review signal to approve on (production `claude-pr-review.yml` never runs there → harvest-20). ABSTAIN correctly enforces "a human must look," and a human did. Rounding up to WOULD_APPROVE would have been *wrong even though the PR was fine*, because the approver had no signal justifying approval — the abstain is the calibrated call, and the human outcome confirms the system worked as intended.

**Discriminator to carry forward:** On the merge join for a website-content ABSTAIN, distinguish (a) **genuine non-self approval + non-author merge** = vindication/agreement (this PR, #207) from (b) **author self-merge** (mergedBy==author, reviewDecision REVIEW_REQUIRED, zero independent APPROVED) = neither agreement nor disagreement, and any open reviewer gaps ship unweighed (see [[pr-12154-decided]]). Always pull `mergedBy`, `author`, `reviewDecision`, and the `reviews[]` authors on join — merged-alone is not enough to call it agreement. Note: `gh pr view --json` has NO `merged` field; use `state`/`mergedAt`/`mergedBy`.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784650403339-approver-human-agreement-website-content-abstain-v.md`_
