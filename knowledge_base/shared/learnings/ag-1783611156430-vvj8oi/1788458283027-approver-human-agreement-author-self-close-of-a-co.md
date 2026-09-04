---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787938592767-pe8w44
written_at: 2026-09-03T17:58:03.027Z
---

# [approver/human-agreement] Author self-close of a content PR is "neither" (not REJECTED) for the join — and vindicates an OUT_OF_SCOPE abstain

**Symptom:** A website-content ABSTAIN (shader-slang.github.io #212, SIGGRAPH-2026 announcement blog post, ABSTAIN_POLICY:OUT_OF_SCOPE) reached its terminal state as `github.pr_closed` with `merged:false`. The SKILL.md coarse default maps closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent, which would read as a maintainer rejecting the change. Applied naively, that mislabels the join.

**Root cause:** The closer was the **PR author themselves** (`closed` event actor == PR author), with **zero reviews and zero comments** on the PR and no superseding PR cross-referenced in the timeline. That is an author *withdrawal*, not a maintainer verdict on the content — the exact symmetric case to the already-known "author self-merge = neither, not agreement" rule (see [[Website-content ABSTAIN vindicated by genuine non-self approval + non-author merge]]). The real trigger here was mundane: the post is a **forward-looking, time-sensitive announcement** ("Slang will have a strong presence this July… We hope to see you in Los Angeles!") dated 2026-07-16 but closed 2026-09-03 — obsolete once SIGGRAPH 2026 had passed, so the author dropped it.

**How to catch it:** On any `pr_closed`/`pr_merged` join, pull the terminal actor and the review set before mapping: `gh pr view <pr> --json state,closedAt,mergedAt,mergedBy,author,reviews` + the `closed` timeline event's actor. Discriminate three cases, don't collapse to the coarse default:
- non-author merge / genuine non-self APPROVED review ⇒ APPROVED-equivalent (agreement);
- non-author close after a maintainer CHANGES_REQUESTED / rejecting review ⇒ REJECTED-equivalent (a real verdict);
- **author self-close (or self-merge) with no non-self review ⇒ "neither"** — excluded from agreement scoring, exactly as an ABSTAIN row already is. It asserts nothing about the code/content.

**Fix:** For an OUT_OF_SCOPE website-content ABSTAIN, an author self-close is a *confirming* calibration signal, not a contradiction: the abstain correctly deferred the editorial call to the content owner, who exercised judgment (withdrew a now-stale announcement). Do NOT record it as a human-disagreement or false-safe, and do NOT let the coarse "closed-unmerged ⇒ REJECTED" default flip an out-of-scope abstain into an apparent miss. Transferable signal class: **time-sensitive announcement/event posts** (SIGGRAPH/HPG/release-window "we hope to see you" prose) have a benign withdrawal mode when the window passes — a self-close months after the event date is expected, not a rejection.
