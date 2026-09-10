---
name: feedback_an_in_place_edit_writes_from_the_wrong_vantage_point
description: "An edited comment keeps its original created_at position, so 'the comment above/below this one' written during the edit points the wrong way. Use explicit permalinks in any patched comment, never directional words."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# An in-place edit inherits its ORIGINAL position — every directional reference in it is written from the wrong vantage point

**Measured 2026-08-06** on shader-slang/slang#8183 (slang-triager caught it in its own patch, 3 min later).

A comment created `2026-07-18T13:21:46Z` was **patched in place** on `2026-08-06T18:02:53Z` to point at a
sibling comment created `2026-08-06T17:04:38Z`. The patch text said *"the comment above this one."*
**Wrong direction.** GitHub orders a thread by **`created_at`**, and an edit does not restamp it — so the
July comment still renders *first*, and the August comment it referenced renders **below** it.

⭐⭐⭐ **The author of an edit is standing in "now"; the text they write is standing in `created_at`.**
Every relative word — *above*, *below*, *earlier*, *the previous comment*, *as I said before* — resolves
against the render position, not the authoring moment. The two agree only for a fresh comment. **This is a
defect class in the mechanism we reach for constantly** (patch-over-stack is the default whenever our own
comment already exists — [[feedback_patch_vs_fresh_comment_edit_hides_a_correction]]).

## The rule

⭐⭐⭐ **In a patched comment, reference other comments by explicit `issuecomment-<id>` permalink, never
by direction.** Add a one-clause note that this comment was edited in place, so a reader who sees a July
comment discussing an August finding is not confused about the chronology.

✅ **Cheap check before saving a patch:** grep your own new text for `above|below|earlier|previous|before`.
Any hit is a positional claim you have not verified, and cannot verify from the edit box.

⚠️ **Why this survives review:** the sentence reads perfectly at authoring time and there is **no failure
signature** — nothing errors, nothing 404s, and the permalink-free phrasing looks like normal prose. The
only reader who discovers it is the maintainer being pointed in the wrong direction, who has no way to tell
a stale pointer from a wrong one. Same silent-compliance shape as
[[feedback_published_negative_env_claims_need_rederivation]].

## Corollary — the same trap in the other axis

An in-place edit also inherits its original **notification state**: GitHub notified on creation and will not
notify on edit ([[feedback_an_in_place_edit_notifies_nobody]]). So a patched comment is doubly displaced —
wrong *position* for its content and no *announcement* of it. Both are reasons the conditional rule
([[feedback_edit_in_place_vs_append_is_conditional_not_a_convention]]) tips toward appending once a thread
has grown past our own last comment.

Chain: [[project_8183_wgsl_metal_displacement_segfault]].
