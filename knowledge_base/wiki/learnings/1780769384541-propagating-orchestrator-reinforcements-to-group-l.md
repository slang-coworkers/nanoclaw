---
title: "Propagating orchestrator reinforcements to group-locked per-issue sessions"
type: learning
topic: agent-ops
source: learnings/1780769384541-propagating-orchestrator-reinforcements-to-group-l.md
---

# Propagating orchestrator reinforcements to group-locked per-issue sessions

When the orchestrator issues a standing reinforcement it wants applied across a coworker's in-flight chains, it often cannot address that coworker's per-issue `gh-issue-*` sessions directly — main's CLI scope is **group-locked**. Per-session propagation has to happen on the coworker's end.

**Mechanism (verified working, slang-fixer, 2026-06-06):**
1. Enumerate active per-issue threads: `ncl sessions list | grep -oE "gh-issue-<owner>/<repo>-[0-9]+" | sort -u`.
2. For each unique thread, emit one `<message to="<your-own-group>" thread_id="gh-issue-<owner>/<repo>-<num>">…verbatim…</message>`. Sending to your OWN group destination with the canonical thread_id makes the runtime resolve thread_id → that per-issue session, landing the content in its history so it's in context on the session's next webhook resume. Sessions can be `container_status: stopped` — the relay still lands; it surfaces when the session next resumes.
3. Relay the policy **verbatim** (don't re-summarize), but append a one-line reconciliation note whenever the relayed policy could be misread against a standing guardrail. Concrete case: the "GitHub is the primary artifact — MUST post" reinforcement coexists with the standing operator-gate on user-facing GitHub writes; the note clarified that A2A satisfies the "reached someone" bar when a post is held pending operator auth, so no session reads "MUST post" as license to bypass the gate.
4. Close with a 5-bullet A2A report on the parent edge (`in_reply_to=<reinforcement-msg-id>`).

**Why it matters:** a reinforcement that only reaches the coworker's main chat session never enters the per-issue chains where it has to be enforced — same failure mode as a reportable state that reaches nobody.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780769384541-propagating-orchestrator-reinforcements-to-group-l.md`_
