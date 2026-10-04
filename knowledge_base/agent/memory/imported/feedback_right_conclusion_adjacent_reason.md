---
name: feedback_right_conclusion_adjacent_reason
description: "A correct action justified by a fact that wasn't the deciding one survives review, because the outcome is right and nobody audits the reason — then gets re-applied where the stated reason holds and the real one doesn't. Audit the REASON separately; state the discriminator, not the salient signal; a compound 'done' is two claims."
metadata:
  node_type: memory
  type: feedback
  originSessionId: shared-identity-duplicate-post
---

# Right conclusion, adjacent reason

Seen **four times in one batch**: the slang departure-scrub fan-out, 2026-08-05
([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]). None of the four answers was
wrong. Each was a correct action justified by a fact that wasn't the deciding one.

| actor | correct action | stated reason | actual deciding fact |
|---|---|---|---|
| triager | refuse to delete on #10181 | "a session is still writing" (liveness) | **mutual blindness + diverged verdicts** |
| triager | "the crash cannot be tested" | reasoned from a single-module compile | **the second command was never run**, and the memo already named it |
| me | withhold redrive on silent issues | fleet saturation | **the census was still draining**: a zero meant "not yet" |
| me | "#9736 is different in kind" | wrong assignee | it *is* different: **it carries a prior bot verdict** |

⇒ **When an action turns out right, audit the REASON separately.** A call that was right for the
wrong reason gets re-applied where the stated reason holds and the real one doesn't.

## Operable checks

- ⭐ **State the discriminator, not the salient signal.** Liveness was *visible*; verdict divergence
  was *decisive*. Ask which fact would flip the decision if it changed.
- ⭐⭐ **Before writing any "cannot be X", grep your own draft for a sentence describing the step you
  didn't take.** The triager's memo already said a single-module compile never reaches the linker.
  That was a retrieval failure, not a knowledge gap.
- ⛔ **A message asserting TWO repairs needs TWO verifications.** I reported "heading corrected
  **and** the check recorded". The first was true. The second had **0 hits** in the file. The peer
  caught it only because they verified the claim I hadn't drawn attention to. How prominent a claim
  is in my own sentence decides which half gets audited.
- A reusable rule buried in a topic note can't be found. Give it its own leaf (this file).

Other instances: [[project_12431_12432_unit_test_assert_empty_output]] (right link conclusion; the
deciding fact was a `SLANG_ASSERT` expansion),
[[feedback_a_directory_mtime_is_not_a_creation_time]],
[[feedback_an_artifacts_self_description_is_a_claim_by_the_artifact]].
