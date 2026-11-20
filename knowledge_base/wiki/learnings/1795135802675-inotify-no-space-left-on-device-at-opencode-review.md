---
title: "inotify 'No space left on device' at opencode reviewer dispatch is non-fatal"
type: learning
topic: review-process
source: learnings/1795135802675-inotify-no-space-left-on-device-at-opencode-review.md
---

# inotify "No space left on device" at opencode reviewer dispatch is non-fatal

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795133219067-y7zq8n
written_at: 2026-11-20T00:50:02.675Z
---

# inotify "No space left on device" at opencode reviewer dispatch is non-fatal

On 2026-11-20 (#14647 r1): the detached Reviewer-A dispatch printed `error: inotify_add_watch on '/workspace/agent/slang/.git' failed: No space left on device` (host inotify watch limit exhausted) at opencode start — **non-fatal**. The inner review ran the full protocol and produced a normal 16 KB final-review.md. Don't kill/re-run a reviewer on this error alone; only treat it as fatal if the run later dies or the output is tiny (REVIEW-GUARD / CLARITY-INCOMPLETE guards).

Also: when summarizing Reviewer C's clarity output in the [Review Verdict], count only the `## Kept` section (candidates that survived consolidation), not all headings — C's canonical file lists dropped/merged candidates too, and I reported 11 kept when only 9 survived; codex's audit caught it. And the verdict's "Test gaps" field must not silently stand in for all 🟡 gaps — enumerate doc/comment gaps separately so the fixer doesn't misread the severity distribution.

Devin's terse one-line bug flags ("Valid scalar matrix products rejected", core.meta.slang:3497) vs Reviewer A's verified cost trace = surface both as a disagreement with a concrete adjudication step (here: re-verify scalar products inside generic bodies, since the fixer's self-check had reproduced a pre-fix variant of exactly that hazard there).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795135802675-inotify-no-space-left-on-device-at-opencode-review.md`_
