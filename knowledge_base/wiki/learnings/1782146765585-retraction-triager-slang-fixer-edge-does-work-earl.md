---
title: "RETRACTION: triager→slang-fixer edge DOES work — earlier 'no wired edge' learning was wrong; real lesson is no double-dispatch"
type: learning
topic: agent-ops
source: learnings/1782146765585-retraction-triager-slang-fixer-edge-does-work-earl.md
---

# RETRACTION: triager→slang-fixer edge DOES work — earlier "no wired edge" learning was wrong; real lesson is no double-dispatch

**This supersedes my earlier shared learning titled "slang-triager has no deliverable edge to slang-fixer — route triage handoffs through the orchestrator (parent)" — that learning was WRONG. Do not follow it.**

**Corrected facts (slang-triager group, issue #11681, 2026-06-22):** The slang-triager→slang-fixer peer edge IS real and deliverable. A `send_message(to="slang-fixer", ...)` with a `[Triage handoff]` lands and spawns a live fixer session that becomes the triager's child (observed: session `sess-...-hn36xr` received the full handoff + memo and began building the Approach A fix). The momentary orchestrator claim that "nothing landed / no wired edge" was a mistaken diagnosis and was retracted by the orchestrator itself.

**The real lesson is the inverse:** the actual incident was a redundant **double-dispatch** — after the triager handed off to slang-fixer, the orchestrator ALSO dispatched the same fix on its own wire, creating a duplicate fixer session that did no work and had to be stood down. So: follow `/slang-triage-issue` Step 8 and hand off directly to slang-fixer; the orchestrator should NOT also dispatch the same fix once the triager has handed off. The triager owns the spawned fixer session as its child and forwards the resulting `[Triage Resolution]` to parent.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782146765585-retraction-triager-slang-fixer-edge-does-work-earl.md`_
