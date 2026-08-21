---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787172126535-cworuh
written_at: 2026-08-20T19:21:46.112Z
---

# [approver/human-disagreement] #12631 scoring, final: a review-STATE abstain cleared by the maintainer's own re-review is NOT falsified by a same-head merge — distinct from a substantive-GAP abstain that ships intact

**Supersedes the scoring in my two prior #12631 atoms** (the "leaned conservative / refuted under the falsifiable reading" characterization). Atoms are immutable, so this appends the final corrected scoring. Reached after a codex critique read the actual 08-07 retraction atoms and pointed out a category error in my join scoring — verified and correct.

**The category error I made.** I applied the falsifiable-reading rule — *"the real claim is 'material enough not to merge as-is', which a clean approval at my head refutes"* — to slang#12631 R2 and concluded the abstain "leaned conservative / was refuted" because the head merged unchanged. That rule was written for a **substantive-gap abstain** (OPEN_GAP: "this code has a gap"), where an independent human approving **with the flagged gap still intact** is the refutation. R2 was a different kind of abstain: its gating artifact was a **formal review STATE** — a live, un-dismissed maintainer CHANGES_REQUESTED — not a code gap (the bot gap was already fixed). That state was real at decision time and was **cleared by the maintainer's own re-review** (→ APPROVED), not left intact. Exact-head code identity therefore does NOT refute it.

**The distinction (transferable scoring rule).**
- **Substantive-gap abstain (OPEN_GAP):** falsifiable by "did a human approve with the gap intact / did the gap ship untouched?" A same-head merge with the gap present ⇒ the abstain leaned conservative. (This is the 08-07 falsifiable-reading case.)
- **Review-state abstain (deferring to a live, un-dismissed human block — CHALLENGER_CONCERN of this shape):** the correct outcome IS the human lifting or maintaining their own block. When they lift it (re-review → APPROVED) and it merges, the abstain is **not falsified** — deferring was the only safe move, and it resolved exactly as designed. It would only be *wrong* if the block had not actually been standing / had already been dismissed (verify that — it stays disagreeable there).

**Why this is NOT the retracted "a human looked = correct" frame.** That frame is un-disagreeable because it scores every abstain correct regardless of what the human did. This scoring stays disagreeable: a review-state abstain is falsified if the block was mis-verified (not actually standing, or dismissed pre-decision). #12631's block WAS standing and un-dismissed at R2 (verified), so the deferral was correct and not falsified.

**What genuinely WAS an error (unchanged from the prior atom, still the durable lesson):** the challenger MISS — I called the necessity question "substantively open" when the author had answered it in an issue comment ~20h before my decision, because I read review states/bodies but never `issues/N/comments`. Read the discussion thread before characterizing a motivation concern as unresolved. That miss is real and independent of the (correct) decision to defer.
