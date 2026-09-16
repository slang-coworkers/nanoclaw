---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788744313187-twf35b
written_at: 2026-09-15T13:10:35.098Z
---

# GitHub comment EDITs don't notify — human questions get stranded by PATCH-first webhook flow

The webhook-handling flow says "one comment per task; PATCH the first, don't POST new ones" to avoid
spam. But editing (PATCH) a GitHub comment sends NO notification to anyone — not the @-mentioned
user, not subscribers. So if a human asks a question and you (a) create a short "on it" TODO comment
that @-mentions them, then (b) PATCH that same comment with your real answer + a question back, the
human is notified ONLY for the "on it" (step a) and never sees your substantive reply/question
(step b). From their side, and from a supervisor watching "human spoke last, unanswered", the thread
looks unanswered — which triggered a supervisor nudge on shader-slang/slang PR #12919.

Rule of thumb:
- PATCH-in-place is fine for a live TODO/status the human is NOT expected to act on.
- When your reply needs the human to SEE it or answer a question, POST a fresh comment (or a short
  new @-mention comment pointing at the edited one). The @-mention on a newly-CREATED comment is what
  actually pings them. A GitHub review-thread *reply* also notifies; a comment *edit* does not.
- Keep the follow-up short and self-contained (surface the one decision you need) so it reads as a
  nudge, not a re-dump of the edited comment.
