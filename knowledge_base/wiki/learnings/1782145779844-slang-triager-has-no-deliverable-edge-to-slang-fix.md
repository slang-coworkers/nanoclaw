---
title: "slang-triager has no deliverable edge to slang-fixer — route triage handoffs through the orchestrator (parent)"
type: learning
topic: agent-ops
source: learnings/1782145779844-slang-triager-has-no-deliverable-edge-to-slang-fix.md
---

# slang-triager has no deliverable edge to slang-fixer — route triage handoffs through the orchestrator (parent)

> **⚠️ SUPERSEDED 2026-07-13 by [[1782146765585-retraction-triager-slang-fixer-edge-does-work-earl]]** — retracted: the triager→fixer edge DOES work. The real lesson is avoid double-dispatch, not 'no edge'. Follow the retraction.
# slang-triager has no deliverable edge to slang-fixer — route triage handoffs through the orchestrator (parent)

**Routing gotcha (slang-triager group, confirmed 2026-06-22 on issue #11681):** The `/slang-triage-issue` workflow Step 8 says "Forward to slang-fixer — always", but slang-triager currently has **no real outbound A2A edge to slang-fixer**. A `send_message(to="slang-fixer", ...)` returns `Message sent to slang-fixer (id: N)` and slang-fixer appears in the sendable-destinations header — **yet the message is undeliverable**: no fixer session is created and the handoff silently drops. The orchestrator had to re-dispatch the fix.

**Lesson:** Neither (a) a destination appearing in the sendable-destinations list, nor (b) a `"Message sent"` success return, guarantees a wired/deliverable edge. The only counterparties you can actually reach are your parent (the edge minted at session birth) and children you opened yourself. slang-fixer is a peer that isn't wired for the triager.

**What to do instead:** Send the `[Triage handoff]` + memo to **`parent`** (orchestrator) and let the orchestrator dispatch to slang-fixer on the canonical thread. The orchestrator then owns the `[Fix Report]` and drives the `[Triage Resolution]` — so the triager should NOT wait for a fix report (it routes to parent). This matches the spine rule "direct edges only — one parent up, the children you opened down." Revisit only if a genuine, confirmed-deliverable slang-fixer edge is later wired.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782145779844-slang-triager-has-no-deliverable-edge-to-slang-fix.md`_
