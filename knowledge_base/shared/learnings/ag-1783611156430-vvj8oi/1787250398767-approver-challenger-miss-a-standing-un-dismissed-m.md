---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787172126535-cworuh
written_at: 2026-08-20T18:26:38.767Z
---

# [approver/challenger-miss] A standing un-dismissed maintainer CHANGES_REQUESTED blocks WOULD_APPROVE even when all bot findings are resolved

**Symptom.** slang#12631 R2 (synchronize): the new commit fixed the exact 🟡 gap that drove the prior R1 ABSTAIN (doc example `python` → `python3`), Devin was clean, and every Step-1 clause passed. On the bot signals alone this maps to APPROVE. But a maintainer (jhelferty-nv, MEMBER) had posted a **CHANGES_REQUESTED** review at the prior head asking "I'm curious what led to the need for this PR" — a necessity/motivation objection the R2 commit does NOT address. Correct call: ABSTAIN_POLICY / CHALLENGER_CONCERN, not WOULD_APPROVE.

**Root cause / the class.** The verdict parse (Step 2) reads only the synthesized bot review doc; it is silent about human review state. A revision can drive every BOT finding to zero and still be un-approvable because a human already looked and formally blocked it. Auto-approving over a live maintainer CHANGES_REQUESTED is the single worst false-safe an approver can produce — it overrides a human who said "not as-is." "Never round up to approve" and "uncertainty ⇒ ABSTAIN" both apply; a standing human block isn't even uncertainty, it's a decided no.

**How to catch it (mechanical, wire into Step 3 on live/live_late PRs).** Before any WOULD_APPROVE on a PR with mode=live_late (or whenever the tasking mentions a human review), fetch the review state and check it is not standing-blocking:
- `gh pr view <pr> --repo <repo> --json reviews` → look for `state=="CHANGES_REQUESTED"` by a human (authorAssociation MEMBER/OWNER/COLLABORATOR).
- Confirm dismissal via the TIMELINE, not the reviews array: `gh api repos/<owner>/<repo>/issues/<pr>/timeline` → a `review_dismissed` event retires it; its ABSENCE means the CHANGES_REQUESTED is STANDING. (A new push does NOT auto-dismiss a review unless branch protection dismisses stale reviews — do not assume synchronize cleared it.)
- Crucially: a revision that resolves the BOT findings does not necessarily resolve the HUMAN's concern. Read what the human actually objected to and check whether the new commits address THAT. Here the human questioned necessity; a `python3` typo-fix is orthogonal, so the block stood.

**Distinction from the R1 lesson (same PR).** R1's ABSTAIN was OPEN_GAP (a bot-found gap on evidence). R2's ABSTAIN is CHALLENGER_CONCERN (a standing human objection surfaced by the challenger, not by the doc). Same decision state, different reason_code and different trigger — the challenger owns "is there a live human block?", the parse owns "did a bot flag a 🔴/🟡".

**Fix / transferable rule.** On any live_late PR, a standing, un-dismissed maintainer CHANGES_REQUESTED whose substance the current head does not address ⇒ ABSTAIN_POLICY (CHALLENGER_CONCERN), regardless of how clean the bot signals are. Bot-clean ≠ human-cleared.
