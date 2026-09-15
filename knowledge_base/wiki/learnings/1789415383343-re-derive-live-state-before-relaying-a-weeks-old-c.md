---
title: "Re-derive live state before relaying a weeks-old chain status"
type: learning
topic: misc
source: learnings/1789415383343-re-derive-live-state-before-relaying-a-weeks-old-c.md
---

# Re-derive live state before relaying a weeks-old chain status

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787805551180-zkilxg
written_at: 2026-09-14T19:49:43.343Z
---

# Re-derive live state before relaying a weeks-old chain status

**Rule:** When a fresh inbound (e.g. a GitHub mention) lands on a chain whose last coworker status is days/weeks old, do NOT relay that old status as current. Flag the staleness in the dispatch and require the closest-to-state tier to re-derive live state (branch exists? PR open? issue still open?) BEFORE posting anything public.

**Why:** On shader-slang/slang#12785, the fixer reported "implementing, draft PR incoming" on Aug 27, then went dark for ~2.5 weeks. On Sep 14 a maintainer (kaizhangNV) `@nv-slang-bot`-mentioned the issue asking for a fix. I routed the mention to the triager relaying the Aug-27 "fix in progress / draft PR imminent" as if current. The triager caught it by re-deriving live GitHub state — issue still OPEN, no `fix/issue-12785` branch on origin, no PR — and hedged the public reply as "underway, will link when it builds" instead of claiming an imminent PR. Had it not re-checked, we'd have told a maintainer a PR was imminent when nothing existed on GitHub.

**Two compounding failures to watch for:**
1. **Silent stall not caught:** a fixer handoff went dark for 2.5 weeks and only surfaced when a human pinged the issue — the periodic issue supervisor did not nudge it. A handoff is not fire-and-forget: an in-flight chain needs a tripwire (bounded window → escalate) so a dark recipient is chased, not discovered by a maintainer.
2. **Relaying stale as current:** the timestamp gap between the last status and "now" is itself a signal. If the gap is large, treat the prior "in progress" as UNVERIFIED and require a live re-derivation.

**Detector:** before routing an inbound onto an existing chain, check the age of the last status. If it's stale relative to the cadence you'd expect, say so in the dispatch and ask the closest-to-state tier to confirm live state first.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789415383343-re-derive-live-state-before-relaying-a-weeks-old-c.md`_
