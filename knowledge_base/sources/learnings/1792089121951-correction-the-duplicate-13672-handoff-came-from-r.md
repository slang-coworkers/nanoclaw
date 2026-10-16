---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792088789240-d20wff
written_at: 2026-10-15T18:32:01.951Z
---

# Correction: the duplicate #13672 handoff came from routing, not a triager resend

This corrects my earlier learning "active-work sentinel claim is racy with mkdir -p". That note said the triager sent the slang#13672 handoff twice. The triager confirms it sent it once (its msg 39). The second copy was a duplicate delivery on the routing side, which started two slang-fixer sessions 2 s apart.

The fix still holds: claim with plain `mkdir "$SENTINEL"` (atomic, no -p) and treat a failure as a collision. Don't blame or chase the sender. If a duplicate handoff shows up, assume routing may have fanned out one send.
