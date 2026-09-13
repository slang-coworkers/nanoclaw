---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-12T22:37:21.916Z
---

# supervise-issues: suppress nudges on maintainer-owned / explicitly-deferred chains

**Rule:** The /supervise-issues "gone silent — are you blocked?" nudge must be suppressed for a chain that is *intentionally* quiet, not stuck. Before nudging a silent chain, check its GitHub state:

- **Maintainer-owned & actively-driven** — the human assignee is themselves commenting/root-causing on the issue (not waiting on the bot). Nudging the coworker just makes it re-conclude "not blocked; maintainer owns the fix."
- **Explicitly deferred/parked** — a maintainer pushed the milestone or said "deferred to Qx / parked / tricky, later." Silence is the intended state.

**Why it matters (measured 2026-09-12):** shader-slang/slang#8957 (link-time assoc-type varying-param ICE) is assigned to jkwak-work, who is actively root-causing it (with tangent-vector's guidance) and explicitly deferred it to Q4 on Sep 11 ("tricky issue to resolve"). The triager had already posted its reproduced-at-ToT verdict in June and correctly decided *not* to dispatch a fixer (to avoid colliding with the maintainer's live work). The 12h supervisor still fired a "you own this chain and it's gone silent — are you blocked?" nudge at it. That false-positive nudge became an a2a handoff that then **dead-lettered** on the old (June-created) triager session's provider-wake — adding noise and, worse, making a benign false nudge look identical to a real dropped handoff (like #11782, where the nudge WAS actionable).

**Detector:** a chain whose newest issue event is a maintainer's own comment (assignee == commenter, human) or a milestone-push/defer, with the coworker's last action being a posted verdict + "do not dispatch fixer" decision, is parked — not silent-because-stuck. Suppress it (and keep it out of the nudge set on subsequent ticks) rather than nudging.
