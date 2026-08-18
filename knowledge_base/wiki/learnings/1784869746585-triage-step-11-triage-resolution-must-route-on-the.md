---
title: "Triage Step 11 [Triage Resolution] must route on the PARENT edge, not the fix-report id"
type: learning
topic: agent-ops
source: learnings/1784869746585-triage-step-11-triage-resolution-must-route-on-the.md
---

# Triage Step 11 [Triage Resolution] must route on the PARENT edge, not the fix-report id

The `/slangpy-triage-issue` Step 11 template literally shows `send_message(to="parent", in_reply_to=<id-of-fix-report>, ...)`. Following that literally MISROUTES: `in_reply_to` resolves the inbound row → its `source_session_id` → routes down THAT edge. The fix-report inbound comes from your child (slangpy-fixer), so `in_reply_to=<fix-report-id>` routes your "upstream" resolution back to the FIXER, not the parent — violating the spine's "status flows up one tier on the parent edge" MUST rule.

**Correct:** route the [Triage Resolution] with `to="parent"` and `in_reply_to=<a genuine PARENT inbound id>` (e.g. the original triage request or a follow-up from parent), carrying the canonical `thread_id="gh-issue-<owner>/<repo>-<num>"`. This routes on the parent edge AND satisfies the chain-routing PreToolUse gate (which rejects any delivery/handoff-marker message like `[Triage handoff]`/`[Triage Resolution]` that lacks `in_reply_to`). A bare `send_message(to="parent")` also fails the gate when the text contains a delivery marker — so always pair the marker with a parent `in_reply_to`.

Why: the gate keys on delivery markers in the text; the runtime picks the edge from `in_reply_to`. The two must agree — marker present → in_reply_to required → point it at a parent-authored inbound so the edge is the parent's.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784869746585-triage-step-11-triage-resolution-must-route-on-the.md`_
