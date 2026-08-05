---
name: feedback_stale_replayed_inbound_can_regress_state
description: A re-delivered old message can silently REGRESS a controlling block — date every inbound against verified state before it moves anything
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# A stale replayed inbound can silently REGRESS your state

Messages can be re-delivered **days or weeks late, verbatim, out of order**. The content reads as
current and substantive, so the normal reflex — *substantive inbound ⇒ update the controlling
block* — will happily overwrite verified newer state with an abandoned older one.

This is the **phantom-correction** failure mode in its worst form: a wrong *subtraction*. An
incorrect addition can be challenged; silently reverting a controlling block to a superseded shape
leaves nothing to challenge, and every reader downstream inherits it.

**How to apply:**
- **Read the inbound's timestamp first**, and compare it against the state you have already verified.
  An inbound is a claim *with a date*, not a description of now.
- **Name tripwire tokens per chain** in the controlling block — identifiers that can only belong to a
  superseded era (an old head SHA, a removed diagnostic code, a retired approach name). Any inbound
  mentioning one is history until proven otherwise.
- **Settle it with one live probe** rather than reasoning: if the message says the fix is X, grep for
  X at the current head. Absence at head is decisive.
- Then **do nothing and send nothing.** A stale replay needs no reply and no correction upstream; the
  correct outcome is that state is unchanged.

**Origin (two independent instances, same session, different tiers — shader-slang/slang#12185 / PR
#12186, 2026-08-03/04):**
- A Jul-24 report was re-delivered to the orchestrator after the Aug-3 approval. Following it would
  have rewritten the controlling block from `APPROVED @65338dbef9 / non-draft` back to
  `DRAFT @107f158ffe / REVIEW_REQUIRED`, erasing ~8 state advances including the shipped fix.
- A Jul-23 report was re-delivered to the triager ~11 days late, describing head `4fbe216b0e` and
  **the E55215 diagnostic as the fix**. E55215 had **0 matches** at the live head — removed in the
  redesign. Acting on it would have regressed a *public* GitHub verdict to an abandoned approach.

Both were caught by dating the message before editing, then confirming with a single grep at head.
That the same trap fired at two tiers within hours is the point: it is not an oddity, it is a
standing property of the transport.

Related: [[feedback_never_relay_a_verdict_not_in_hand]] ·
[[project_memory_files_over_read_limit_backlog]] (controlling-block-at-top exists so truncation eats
old history, not new corrections — the same asymmetry) ·
[[project_12185_bindless_texture_nv_desc_handle_nonimage]].
