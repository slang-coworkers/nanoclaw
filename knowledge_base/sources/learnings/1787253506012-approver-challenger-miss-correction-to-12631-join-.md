---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787172126535-cworuh
written_at: 2026-08-20T19:18:26.012Z
---

# [approver/challenger-miss] CORRECTION to #12631 join: the necessity question WAS answered in an issue comment ~20h before my R2 decision — I read review states, never the comment thread

**Corrects the prior atom** "[approver/human-disagreement] JOIN #12631: a 'why is this needed?' CHANGES_REQUESTED clears with zero code change". Atoms are immutable, so this appends the correction rather than editing it. Verified against GitHub after a critique catch.

**Factual correction.** My prior atom and my R2 challenger both stated the maintainer's necessity concern was "substantively unaddressed / unresolved on the current head" at R2 decision time. That is FALSE. kaizhangNV answered it in an **issue comment at 2026-08-19T22:28:57Z** — about 1h after the CHANGES_REQUESTED and ~20h BEFORE my R2 decision (2026-08-20T18:25Z): "My agent occasionally stops working if it can't find git.exe, gh.exe, cmake.exe. I have to tell it, don't find git.exe, use git, this is native linux, not wsl." I read the review *states* (`gh pr view --json reviews`) and the review *bodies*, but I never fetched the issue *comment* thread (`issues/N/comments`), so I mischaracterized an already-answered question as open. jhelferty-nv then APPROVED the same head 25 min after my decision and it merged unchanged (merge commit bcbb82dd).

**Root cause (the class).** An auto-approver's Step-3 challenger that reads review states/bodies but not the issue comment thread is blind to author↔maintainer discussion — exactly where a "why is this needed?" block gets resolved. The substance of a motivation block lives in comments, not commits or review bodies.

**How to catch it.** On any live_late PR where a human review is the gating factor, before characterizing that concern as "unresolved," fetch `gh api repos/<o>/<r>/issues/<pr>/comments` (and PR review-thread replies) and read for an author response to the reviewer's point. "Unaddressed in the diff" ≠ "unaddressed" — a discussion answer counts.

**What still stands.** The DECISION was operationally correct: an auto-approver must not override a live, un-dismissed maintainer CHANGES_REQUESTED even if it believes the author answered — only the maintainer can clear their own block. So ABSTAIN over the formal block was right. But the CALIBRATION note is refined: at R2 the only genuinely-pending thing was the *formal* un-dismissed state + re-review, NOT the substance (already answered ~20h prior). The head merged unchanged ⇒ conservative under the falsifiable reading. Do NOT round to "correct because a human looked."

**Scoring-frame note (holds the line vs the critique).** A codex critique pushed to reclassify this as a "neutral human resolution, excluded from agreement scoring." Declined on that framing: the store retracted (08-07) the "abstains are excluded from scoring / a human looked = resolution" frame precisely because it makes every abstain un-disagreeable and lets the loop punish only false-approves. The honest score is a conservative-leaning abstain, joined and kept disagreeable — not a neutral non-event. The word "human-disagreement" in the prior atom's title was imprecise for a formal-state deferral; the substance (conservative, joined, not rounded up) is the durable part.
