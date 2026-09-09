---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787273068610-gcdnaz
written_at: 2026-08-21T00:58:02.132Z
---

# [approver/challenger] live_late head carrying open+agreed maintainer change-requests is an ABSTAIN even when code is clean

**Class of signal:** On a `live_late` PR (a human has already reviewed), before Step 3 clears toward WOULD_APPROVE, read the review THREAD against the pinned head's timestamp — not just the review *state* field. A maintainer can leave the review formally `COMMENTED` (never `CHANGES_REQUESTED`) while posting explicit "please remove X / please add Y" comments AT the current head, and the author can reply "will do, reworking." That head is then a **known-superseded design** with open, agreed, in-flight change-requests. Approving it is a false-safe over a live redesign, regardless of how clean the code is.

**Instance (shader-slang/slang #12417, 2026-08-21, ABSTAIN_POLICY/CHALLENGER_CONCERN @c98ef6c2311d):** "Unroll the generic FP `dot` fallback." Devin 0 bugs, clauses 6/6 pass, strong trigger-present tests, pass-order argument verified sound — technically clean. But the shepherd maintainer (jkwak-work) posted, minutes before the `synchronize` that dispatched the decision: "Please remove the static_assert and any lines related to `kCoreModule_MaxVectorElementCount`. Just adding `[ForceUnroll]` should be enough" (hlsl.meta.slang:10131) and "Please add `[ForceUnroll]` here too [integer arm] + check the Metal spec" (:10204). The bot author agreed at 00:46Z and committed to reworking. The head under decision still contained the plumbing marked for removal. Auto-approving would approve a design the maintainer explicitly asked to change and the author agreed to change.

**Why the `synchronize` webhook is a trap here:** the event fired with NO new commit — it re-triggered on the maintainer's fresh review comments on the SAME (only) commit. So "synchronize" does not imply "author responded to feedback"; the response may be *pending*. Check `commits | length` and the last-commit timestamp against the newest review-comment timestamp.

**How to catch it (positive control for the challenger on live_late PRs):**
1. Pull the review-comment thread with timestamps (`github_get_pull_request_comments` / issue timeline), not just `reviews[].state`.
2. For any maintainer comment newer than (or at) the head commit that reads as a change-request ("remove", "please add", "should be", "why don't we"), check whether the head still reflects the old design. If the author has AGREED but not yet pushed, the head is superseded ⇒ ABSTAIN (CHALLENGER_CONCERN), hand to the human already directing it.
3. A formal state of `COMMENTED` (not `CHANGES_REQUESTED`) does NOT downgrade this — maintainers on this repo routinely request substantive changes in COMMENTED reviews.

**Scoring:** this abstain PREDICTS a superseding push. Score it correct if the human/author changed this head (they asked to); score it a false-abstain ONLY if the human approved/merged this exact head unchanged. Complements [approver/false-safe] PR12098 (where the maintainer's concern was a *subtle* design smell the challenger dismissed) — this is the *explicit* version: the instruction is right there in the thread.
