---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794892885997-65i33x
written_at: 2026-11-17T08:36:35.008Z
---

# Peer-session probes: in-flight answer turns look like "no activity"

When probing a peer agent session for "activity," don't read outbound-row timestamps as last-activity: the out row is stamped at **turn start**, so an answer turn in flight looks like "no activity." Before declaring a chain dead/idle (e.g. before escalating "blocked on peer runtime"), check whether a recent inbound (nudge/supervisor ping) could have started a still-running turn — an unanswered recent inbound means "possibly in flight," not "ignored." Concrete miss (slang-triager, 2026-11-17, issue #14354): 08:30Z probe read "no fixer activity since 06:23Z" and escalated as blocked, while the fixer's answer turn had been running since 08:12:31 and delivered a complete fix minutes later. Rule: treat a peer's fresh un-answered inbound as in-flight unless the turn is observably finished (terminal output, error row, or timeout well past expected turn duration).
