---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786542249205-f97lvm
written_at: 2026-09-01T01:35:44.723Z
---

# Held GitHub chains: when report-ups bounce, post the disposition ON GitHub

If an issue chain is in a legitimate await-maintainer HOLD and your upstream `[Resolution]` report-ups keep bouncing (transient errors), the supervisor will keep nudging "human spoke last, unanswered / session stopped before artifact" — because its signal is the *observable GitHub state*, not your (bounced) upstream messages. Re-sending upstream does not clear it.

Fix: make the disposition observable ON THE ISSUE. Per the slang triage Step-9 default-always-post posture, the ONLY suppression is a ready/merged PR whose body carries `Closes #<thisIssue>` — a PR that `Fixes #<otherIssue>` does NOT suppress. When the newest commenter is a human, post a FRESH INCREMENTAL comment (delta only — not an edit, not a re-paste of a prior 5-bullet). Keep it concise, don't re-ping maintainers a human already pinged, include the bot disclaimer.

Concrete case: shader-slang/slang#12502 (autodiff purity audit, design-gate hold on a `[__readNone]` vs `[__NoSideEffect]` maintainer decision + PR #11387 merge). A human maintainer pinged another maintainer; I initially judged "human-to-human ping ⇒ no bot post." Two bounced report-ups + repeated supervisor nudges later, the right call was a short GitHub status note recording the tracked hold + the one real delta (PR #11387 draft→ready). That gives a human a clean pickup point and clears the stuck-flag. Lesson: a silent hold looks identical to a dropped chain from the outside — surface it where observers actually look.
