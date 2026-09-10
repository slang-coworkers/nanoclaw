---
name: feedback_a_recommendation_cannot_cite_what_it_causes
description: "A doc that RECOMMENDS an action cannot name the artifact that action produces — the artifact does not exist yet. So 'trail closed on both ends' is false by construction at the recommending end, and needs a back-patch. Detector: grep the causing artifact for the caused one's id."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# A recommendation cannot cite what it causes

**Measured 2026-08-06 on slang #12371 → #12383.** PR #12382's *Known limitation* section ended
*"Filing it as its own issue is the right next step."* The follow-up issue #12383 was then filed, and
its body asserted the defect was *"recorded there and in #12382's 'Known limitation' section so the
trail is closed on both ends."*

Half true. I checked both ends instead of accepting it:

- #12371's verdict comment **did** name #12383 (patched in place 34 s after the issue was created).
- PR #12382's body **did not** — `mentions_12383: false` on a 14,713-byte body.

**Why:** the PR body was authored *before* #12383 existed. A document that recommends creating an
artifact cannot cite that artifact's identifier — the recommendation is what brings it into being.
The forward link is **unavailable at authoring time by construction**, not forgotten.

**Why it matters here rather than being pedantry:** three reviewers were mid-review on that PR when
the issue landed. A reviewer reading *"filing it as its own issue is the right next step"* has no way
to tell whether that step was taken, so the live options are to re-raise it as a review comment or to
go looking. Both cost a round-trip that a nine-character edit removes.

**Why:** "both ends" is a claim about a *pair* of artifacts, and one of the pair is always the
younger. Any bidirectional-link claim made by the younger artifact is self-serving — it can see the
older one, and it cannot make the older one see it. Only an edit to the older artifact closes it.

**How to apply:**

- When a doc says *"this should be filed / tracked / split out"* and you then file it, **immediately
  back-patch the causing doc with the resulting id.** Treat it as part of the filing, not a
  follow-up — an unpatched forward link has no trigger that will ever fire
  ([[feedback_a_deferral_whose_trigger_cannot_fire_is_a_deletion]]).
- **Never accept a "cross-referenced both ways" claim from the newer artifact.** Grep the *older*
  one for the newer one's id. One command, and it is the only direction that can be wrong:
  `gh pr view <pr> --json body --jq '.body|test("<new-id>")'`.
- Generalises past GitHub: a design doc recommending a ticket, a TODO naming a future PR, a memory
  leaf saying "split this out". ⭐ **The artifact that caused the split is always the one missing the
  link.** So point the check at the cause, not the effect — the effect always looks correct.

Instance record: [[project_12383_spirv_validation_before_spvopt_strip]].
Companion on trusting a body's own self-description: [[feedback_an_artifacts_self_description_is_a_claim_by_the_artifact]].
