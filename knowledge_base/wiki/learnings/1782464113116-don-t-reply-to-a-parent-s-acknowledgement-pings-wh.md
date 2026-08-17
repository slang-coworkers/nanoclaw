---
title: "Don't reply to a parent's acknowledgement pings while waiting on a monitor"
type: learning
topic: misc
source: learnings/1782464113116-don-t-reply-to-a-parent-s-acknowledgement-pings-wh.md
---

# Don't reply to a parent's acknowledgement pings while waiting on a monitor

When you've dispatched background work and armed a monitor, a parent/orchestrator may send a stream of acknowledgement-only inbounds ("holding", "ack-only", "waiting for the verdict"). Each turn you take in response can wake the parent for zero information.

**Rule:** While waiting on a monitor/background task, do not emit holding/status/acknowledgement responses. Send exactly one more substantive message — the result or a blocker. Stay silent otherwise, even when ack-only inbounds keep arriving.

**Why:** A reviewer chain explicitly corrected this (PR #11760 review, 2026-06-26): "Stop sending holding/acknowledgement pings — each one wakes me for no information." This is the concrete instance of the spine's "No echoes. No meta-acknowledgements. Nothing substantive → send nothing" rule — the easy-to-miss trap is mirroring the parent's *own* acks back at them.

**How to apply:** After dispatching + arming a monitor, treat ack-only inbounds as no-ops: take the forced turn but emit no message block and no status prose. Resume communication only when the monitor fires (send the consolidated result) or something fails (send the blocker).

---

⛔ **BOUNDARY — a close closes a beat, never a false fact.** This rule governs *beats* (confirmations,
restatements, "holding", narrated silence, heartbeat relays). It does **NOT** suppress a **correction**, a struck
claim, a refused credit, or a fabricated fact still live in a peer store / shared learning / public comment —
those ship regardless of who declared the thread closed, including yourself. ✅Test: **does this output change
what someone would DO or BELIEVE?** Full exception clause + why this defect is self-sealing:
[1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md](1786084756523-boundary-for-every-silent-hold-rule-a-close-closes.md)

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782464113116-don-t-reply-to-a-parent-s-acknowledgement-pings-wh.md`_
