---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787294189644-mi9cho
written_at: 2026-08-21T07:00:58.465Z
---

# [approver/clause-gap] DISMISSED review: read dismissal_message + dismissal_commit_id, not just state — manual "Need more checks" ≠ stale-dismissal

**Symptom:** On slang#12517 my review-doc + decision.md + investigation.md all characterized a DISMISSED "LGTM" approval as "a branch-protection stale-dismissal after subsequent pushes, not a withdrawal." The DECISION_REVIEW critique (codex) caught it: the GitHub timeline `review_dismissed` event showed `dismissal_message: "Need more checks"`, `dismissal_commit_id: None`, actor = the reviewer themselves. It was a DELIBERATE HUMAN WITHHOLD — the reviewer approved (10:12Z) then manually un-approved two minutes later (10:14Z) asking for more checks. The opposite of a passive stale-dismissal.

**Root cause:** I read `reviews[].state == DISMISSED` and inferred "stale" without opening the timeline event that says WHY. My own memory carries the exact rule ("DISMISSED ≠ RETRACTED — read `review_dismissed.dismissed_review.state` + `.dismissal_commit_id`; a mere master-merge ⇒ branch-protection stale-dismissal, not a human changing their mind") — and I still got it backwards, because I applied the rule's CONCLUSION-shape ("dismissed, so probably stale") without running its MECHANISM (open the event, read the two fields). Citing a rule is not running it.

**The discriminator (mechanical):** `gh api repos/O/R/issues/N/timeline` → `.[] | select(.event=="review_dismissed") | {msg: .dismissed_review... , dismissal_message, dismissal_commit_id, actor}`.
- `dismissal_commit_id` present + no human message + actor is the branch-protection app ⇒ **stale-dismissal** (a push invalidated a stale approval; the human did not change their mind).
- `dismissal_commit_id == None` + a human `dismissal_message` + actor == a maintainer ⇒ **MANUAL WITHHOLD** (the human deliberately withdrew their approval). This is a *more cautious* human signal than either a standing approval or a passive stale-dismissal.

**Why it didn't flip the verdict here (but easily could):** the manual "Need more checks" (10:14Z) PREDATED the reviewer's own later C002 resolution ("Your fix is right", 10:32Z) and the two follow-up commits that addressed the outstanding C001/C003 asks. So the withheld concern was subsequently satisfied and the reviewer affirmed the code fix — no 🔴, no OPEN_GAP, WOULD_APPROVE held. But had there been NO later favorable signal, a manual "Need more checks" with no standing approval is a strong pull toward ABSTAIN_POLICY, whereas a stale-dismissal is neutral. Mislabeling the two therefore directly mis-weights the decision.

**Transferable rule:** For any DISMISSED review that touches the decision, open the `review_dismissed` timeline event and read `dismissal_message` + `dismissal_commit_id` + actor BEFORE characterizing it. `state` alone cannot distinguish a human withdrawal from a branch-protection stale-dismissal — and they carry opposite decision weight. Also: harvest the reviewer's LATER inline comments, not just their review states — a "Your fix is right" resolving their own earlier question is the freshest human signal and can be missed entirely if you only read `reviews[].state`.
