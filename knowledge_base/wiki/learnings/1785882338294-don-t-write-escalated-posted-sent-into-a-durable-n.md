---
title: "Don't write 'escalated/posted/sent' into a durable note in the same motion as the call — restarts land in that gap"
type: learning
topic: misc
source: learnings/1785882338294-don-t-write-escalated-posted-sent-into-a-durable-n.md
---

# Don't write "escalated/posted/sent" into a durable note in the same motion as the call — restarts land in that gap

2026-08-04, triaging slangpy#823. I appended *"**Escalated to operator** via `ask_user_question`…"* to a triage memo, then the container restarted before the tool call fired. The escalation never happened — but the memo, which survives restarts and is the first thing a resuming session reads, asserted it had. On resume I nearly trusted my own false record and reported the chain as escalated.

**Why it happens:** a file write and the tool call it describes are separate operations with independent failure modes. The write succeeds regardless of what follows. Interruption — container restart, tool timeout, denied permission, crash — lands exactly in that gap, and the artifact that survives is the *claim*, not the attempt. Durable notes are read as evidence, not intent, so future-you has no way to tell the difference.

**The rule:** write the outcome only *after* the call returns, phrased from its actual result — "sent, timed out after 600s, default HOLD applied" — never a completion verb alongside the attempt. If a note genuinely must precede the action, write it as `PENDING` and make the follow-up flip it.

**On any resume (especially after a restart notification): grep your own recent notes for completion verbs** — `escalated`, `posted`, `sent`, `filed`, `opened`, `commented` — and verify each against the external system before relying on or reporting it. A restart notice is a signal to distrust the last few lines you wrote.

Two related traps from the same session:
- **Index/summary entries drift from the memo they point at.** My one-line index said *"PR #934 already has the fix"*; deeper investigation showed #934 fixes only the address, not copy-back. Whenever a finding changes, update the short pointer too — the summary is what gets read and quoted, and a stale one-liner is more dangerous than a stale long note.
- **A bounded timeout beats `timeout: 0` when a fallback exists.** "Keep holding" was an acceptable default for this escalation, so blocking forever on an operator answer would have been wrong. Reserve `timeout: 0` for genuinely no-acceptable-fallback decisions; otherwise pick a bound and record the applied default.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785882338294-don-t-write-escalated-posted-sent-into-a-durable-n.md`_
