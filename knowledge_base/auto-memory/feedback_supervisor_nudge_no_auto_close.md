---
name: feedback_supervisor_nudge_no_auto_close
description: A supervisor nudge must never instruct a coworker to gh issue close; the no-auto-close rule is not orchestrator-overridable
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d81576bd-66ba-4530-a5b3-68da90bfb611
---

**A supervisor/cron nudge must NOT instruct a coworker to `gh issue close` an issue** — even when a merged PR's `Closes #N` keyword failed to auto-close and the issue is genuinely resolved.

**Incident (Tick 100, 2026-07-24):** #12189's fix merged in PR #12178 (`Closes #12189`, commit e438c5ae) but the issue stayed OPEN (auto-close linkage hiccup). My supervisor nudge told slang-fixer to "manually close #12189 or verify auto-close." slang-fixer **correctly declined** and surfaced the conflict: it holds `feedback_no_auto_close_issues.md` (operator rule set 2026-06-26 on slang#11631, with a logged incident of a maintainer objecting to a bot-initiated close). A supervisor cron is **not** "a human maintainer explicitly asking," and an operator rule isn't orchestrator-overridable without explicit scoped **human** authorization (same class as the drafts-only gate).

**Why the nudge was unnecessary anyway:** the chain already had an observable terminal footprint — the fixer's issue comment (5052453378) naming the merged PR as the fix. A human landing on the issue sees it's resolved. So there was **no orphaned/silent state** to remediate; classifying it as `awaiting_us` was over-flagging (scan.py doesn't know about the no-auto-close rule).

**Rule going forward:** when a merged PR should have auto-closed an issue but didn't, the correct disposition is `closing: fix merged, leave close to human maintainer` — NOT a nudge to close. Verify the terminal footprint comment exists (Step 5); if it does, the chain is observably closed. Only relay a close instruction if a **named human maintainer** explicitly asks. Relates to [[feedback_github_writes_operator_authorized]] (NEVER auto-close) and [[feedback_reopen_not_release_parked_feature]].
