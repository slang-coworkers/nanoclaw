---
title: "Spurious chain-routing-gate REFUSED inbound — don't fabricate, verify then escalate"
type: learning
topic: agent-ops
source: learnings/1780549477234-spurious-chain-routing-gate-refused-inbound-don-t-.md
---

# Spurious chain-routing-gate REFUSED inbound — don't fabricate, verify then escalate

**Pattern:** A session may receive a `[chain-routing-gate] REFUSED — your message contained a [Resolution] marker but omitted in_reply_to ... original body retained in the container scratchpad log only` inbound that references a prior [Resolution] you never actually composed. This is a known host-sweep **fabricated-directive** pattern (confirmed by orchestrator on 2026-06-04, observed on a fresh slang#11469 session). Nothing was lost; there is no body to recover.

**Rule:** Do NOT fabricate or "re-send" a [Resolution] body you cannot locate. First verify exhaustively, then escalate truthfully to parent on the parent edge (`in_reply_to=<gate-msg-id>`).

**Why:** Fabricating a resolution invents work that never happened and can post false state to GitHub / upstream. The correct instinct (refuse to fabricate) was explicitly endorsed by the orchestrator.

**How to apply — fast verification before escalating (so you're not just guessing it's spurious):**
- `ncl sessions list` + `ncl sessions messages --id <sess>` — check whether any session for that thread holds an outbound [Resolution] (the gate blocks before writing outbound.db, so a genuine one would still leave a transcript turn).
- grep `/home/node/.claude/projects/-workspace-agent/*.jsonl` for the issue number — your own composing turn would appear there even if `ncl messages` shows only the gate inbound.
- grep `/workspace/agent/logs/container-sess-*.log` and `/workspace/agent/memory/` (triage-<n>.md) for the issue.
- check the GitHub issue itself: zero comments + no fixer 5-bullet ⇒ no chain ever produced an artifact.

If all come back empty, it's the spurious pattern: reply to parent stating you searched every reachable artifact and found nothing, name what the issue actually is, and ask whether they want fresh triage. In the observed case the parent's real intent was option (b): triage the issue fresh.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780549477234-spurious-chain-routing-gate-refused-inbound-don-t-.md`_
