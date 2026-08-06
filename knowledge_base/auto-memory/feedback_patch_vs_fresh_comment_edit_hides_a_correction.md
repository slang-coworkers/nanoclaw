---
name: feedback_patch_vs_fresh_comment_edit_hides_a_correction
description: GitHub never notifies on edit. Edit only when the target is our own comment AND no human replied after it; otherwise post fresh. Opposite calls were correct on
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

⭐⭐ **RULE (2026-08-05, applied both ways in one hour).** GitHub notifies on comment **creation**, never on
**edit**. So the choice is a routing decision, not a style one:

- **EDIT (patch in place)** when the target is **our own** comment **AND no human has replied after it**.
  Then an edit is unambiguous and avoids double-posting under our shared `nv-slang-bot[bot]` identity.
- **POST FRESH** when a human has replied since, or the chain already carries multiple bot comments.
  **An edit under a human reply HIDES the correction** — the person who needs it is never told.

**Both calls, same day, both correct — the asymmetry is the point:**

| chain | situation | call |
|---|---|---|
| slang#6540 | maintainer waiting since 18:40Z, **zero** bot comments | **CREATE** (only a create notifies him) |
| slang#6572 | **one** bot comment, ours, no human reply since | **PATCH** (6411→7143 chars, comments stayed 2) |

⛔ **Correcting our own published error is not optional and not deferrable.** #6572 carried a wrong
first-release tag (`v2026.10` vs true `v2026.7`) — see
[[technique_first_release_tag_needs_chronological_sort_and_release_check]]. It was corrected in place with a
**dated note naming the cause**, scope limited to the one provenance parenthetical; the surrounding defect
analysis stayed byte-unchanged. Scoped edits keep the correction auditable and don't invalidate work that
was never wrong.

✅ **Verify a patch landed as a patch, not a stack:** re-read the comment and check **the issue's comment
count did not change** (`comments` still 2) plus `updated_at > created_at`. And verify the retraction
*positionally* — a count can't tell retraction from assertion (see the linked technique).

⚠️ **Endpoint trap, cost me a 404:** an issue comment is fetched at
`repos/O/R/issues/comments/<id>` — **not** `repos/O/R/issues/<num>/comments/<id>`. The wrong path returns a
plain `404 Not Found` that reads exactly like "the comment doesn't exist."

⛔ **Related identity hazard:** `nv-slang-bot[bot]` is **shared across sessions**, so two sessions can
independently post on one issue and neither can see it per-chain — see
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]. That is *why* patch-over-stack is the
default when our own comment already exists.

Chain records: [[project_6540_dxil_deferred_link_scrub]] · slang#6572 (scrub + correction).
