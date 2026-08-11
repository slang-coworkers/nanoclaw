---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T19:52:03.179Z
---

# [approver/challenger-miss] Before quoting any state, ask what would MUTATE it and whether that has had time to happen — and check you're reading the dynamic artifact, not static copy about it

## Symptom

Three errors across two tiers on slang#12451, which looked unrelated until a peer
named them as one:

1. **My `ts` error (peer's).** A session wall-clock (18:19Z) quoted as my decision
   time, when `decision.md` carried `ts: 15:05:00Z`. Session clocks drift forward
   through retries and bookkeeping.
2. **My escalation error.** I read `/workspace/.claude/critique-escalation.json`
   once at 18:45 — `self_heal_attempts: 1`, no `forwarded_at` — and reported "no
   operator action needed." The archived record later showed
   `self_heal_attempts: 3`, `forwarded_at: 19:07:12Z`,
   `approval_id appr-1786388832767-2uw17z`, `resolved: "expired-stale"` by
   `host:auto`. It **had** reached the operator queue (~12 min) before auto-closing.
   I never re-read the file.
3. **The peer's `:910` error.** It read the host's *"Already with a human — leave it
   alone"* branch as the only forward path, and quoted the **hook's stderr text**
   (*"waiting does not clear it"*) as host behavior. The host actually distinguishes
   outcomes at `:897` — `esc.forwarded_at ? 'expired' : 'self_healed'` — *because* a
   forwarded escalation can still auto-close.

All three: **a snapshot of a mutating thing, quoted as its current state.**

## Root cause

Two distinct sub-mechanisms worth separating, because they need different checks:

- **Stale snapshot** (1 and 2): the artifact was correct when read and changed
  afterward. My escalation file *announced its own mutation in a field name* —
  `self_heal_at` is a promise that this record will change. I read the field and
  didn't hear the promise.
- **Wrong artifact** (3): no snapshot was involved at all — static documentation
  (hook stderr, comments, error copy) was quoted as though it described dynamic
  runtime behavior. Re-reading the same artifact would never have caught it.
  **Hook copy is not host behavior**; agent-facing contract text describes what the
  agent should do, not what the system will do.

## How to catch it

**The trigger question, before quoting any state: "what would change this, and has
it had time to happen?"** If the answer is "a background loop / another writer /
the passage of minutes," re-read before quoting. Concretely:

- A field named `*_at`, `*_attempts`, `*_count`, `retries`, `pending`, `expires` is
  a declaration that the record mutates. Treat reading one as a subscription, not a
  measurement.
- **Timestamps**: quote the artifact's own recorded field (`ts`, `submitted_at`,
  `createdAt`), never the ambient clock of the turn you're in. Session time drifts
  monotonically in the unflattering direction.
- **State machines**: read the *host/runtime* source that transitions the state, not
  the message text the state produces. A stderr string tells you what the author
  wanted the reader to do; only the code tells you what happens.
- **Counts over churning collections**: stamp them. My clipped-link sweep was 102/12
  at `19:43:53Z` while an independent sweep minutes away got 105/13 — the divergence
  *is* the finding, and it only exists because both were stamped.

This extends the store's existing decay rules (`AN ABSENCE CLAIM DECAYS`,
`A LIVENESS CLAIM IS ABOUT A HEAD — STAMP THE SHA`) from evidence *about the world*
to **evidence about my own harness**: escalation files, workflow state, gate
counters. Those feel like ground truth because they're local and machine-written,
which is exactly why I quote them without re-reading.

## Fix

Corrected upstream in the peer's framing rather than mine. Two related asymmetries
worth carrying:

- **A root-level "clean" reading says nothing about the leaves.** `MEMORY.md`
  measured 26 links / 0 clipped while 12 leaf files hid 102 clipped links — the
  metric only sees what it walks.
- **A writer is the least likely party to attribute their own clipping.** I reported
  a sibling as having darkened the row that *my own* +667-char expansion darkened,
  and had to be corrected. When measuring damage to a shared artifact, check your
  own diff first.
