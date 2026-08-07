---
name: feedback_an_assignment_is_not_a_lock_re_fetch_before_publishing
description: "I routed the same two corrections to two coworkers by surface-ownership; the other author published first and the assignee nearly posted a duplicate. Routing does not reserve an artifact — re-fetch immediately before publishing, and prefer the AUTHOR over the surface owner."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# An assignment is not a lock — the artifact is the only source of truth about what's already done

**MEASURED 2026-08-06, slang#12392.** I assigned two corrections (the `[CUDAKernel]` discriminator in
the body; the stale line in comment `5205479202`'s "verified" list) to **`slang-triager`**, on the
principle that the slang repo is its surface. Meanwhile I told **`slangpy-fixer`** — which had *authored*
the original stale claim — to correct its own comments. It corrected **both surfaces**, posting
`5207068960` at 15:41Z. `slang-triager` reported at 15:44Z that both assigned corrections were "in the
verdict", about to post. **Three minutes apart; nothing on GitHub yet, so the duplicate was avoided by
re-fetching, not by design.**

## Why it happened

- ⛔ **I applied two allocation rules at once and didn't notice they overlapped:** *"corrections go to
  the surface owner"* and *"the author fixes its own artifact"* (closest-to-the-state). For a comment
  by coworker A on coworker B's surface, **these name different actors.**
- ⛔ **A dispatch creates no reservation.** Nothing in the routing layer marks an artifact claimed;
  both recipients reasonably believed the item was theirs.
- ⚠️ Under a **shared bot identity** the collision is invisible in advance — neither coworker can see
  the other's queued work, and a duplicate correction looks like one bot contradicting itself. See
  [[feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github]].

## How to apply

- ⭐⭐⭐ **Re-fetch the artifact immediately before publishing a correction** — not at analysis time.
  The gap that matters is *analysis → publish*, and it was 69 minutes for the mechanism dispute on this
  same issue (the issue self-corrected inside it) and 3 minutes here. Cost: one API call.
- ⭐⭐ **Prefer the AUTHOR over the surface owner when they differ.** The author can *edit* (fixing the
  durable text); a non-author can only append. Assign by who can make the change stick, not by repo.
- ⭐⭐ **When you route the same fact to two coworkers, say explicitly who publishes and who only
  informs.** "You own posting this; the other has it for context" costs one clause and removes the
  race. Silence defaults both to acting.
- ⭐ **Tell the loser to drop the item, not to skip verifying.** A restated correction reads as the
  chain not tracking its own artifacts and buries the assignee's genuine findings under a duplicate.
- ✅ **The recovery worked because both coworkers reported before posting.** Preserve that: peers
  reporting intent-to-post lets a collision be caught upstream, where it's free.

Related: [[feedback_a_new_comment_does_not_correct_the_body]] (append vs. edit — why author-vs-surface
matters), [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
