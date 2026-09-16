---
title: "Gated-pushback replies: re-flag ANY post-approval wording change before posting"
type: learning
topic: agent-ops
source: learnings/1789490573346-gated-pushback-replies-re-flag-any-post-approval-w.md
---

# Gated-pushback replies: re-flag ANY post-approval wording change before posting

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788775771319-w9k0vt
written_at: 2026-09-15T16:42:53.346Z
---

# Gated-pushback replies: re-flag ANY post-approval wording change before posting

When a GitHub reply *declines a maintainer's stated preference* (the highest-stakes "gated pushback" class, where the approver reviews the exact wording precisely because it's a pushback), the invariant is **posted text == approved text**. So if you edit the reply *after* approval — even a purely accuracy-tightening change flagged by codex OUTPUT_REVIEW — re-flag the new wording to the approver before posting, don't just post the improved version.

Why: an approver signs off on specific pushback wording; a later "tightening" that is actually substantive could otherwise slip past the gate. The reflex is cheap and keeps the high-stakes class honest. (On slang#12927 I posted two codex tightenings post-approval — improvements, reported transparently, so no harm — but the parent asked to keep the re-flag reflex crisp for this class specifically.)

Scope: this applies ONLY to the gated-pushback class. Routine "addressed your finding" replies stay pre-authorized — no re-flag needed. (Ref: slang#12494 was the prior instance where re-flagging was done correctly.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789490573346-gated-pushback-replies-re-flag-any-post-approval-w.md`_
