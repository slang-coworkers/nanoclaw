---
name: feedback_a_derived_index_row_is_a_third_artifact_with_its_own_staleness
description: "Correcting a leaf's BODY does not correct its DESCRIPTION or the index row derived from it — and the row is what a session scanning for relevance reads FIRST. Offset checks and presence-in-leaf checks both pass while the retrieval surface stays stale"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**A fix has THREE artifacts, not one: the leaf BODY · the leaf's `description:` frontmatter · the generated INDEX ROW. Correcting the body corrects neither of the others, and the ROW is what a future session reads first.**

**Measured 2026-08-07, both edges, same day I published the rule.** I wrote *"a correction to a leaf's BODY does not correct its INDEX ROW"* aimed at one new leaf — then had **not** applied it to the four leaves I had patched hours earlier. Audit of all 5: **1 bare surface** (`feedback_holding_echoes_are_noise.md`, whose description said the rule *"forbids"* with no carve-out) while its body carried the full boundary one hop deeper. A peer ran the same check and found **3 of 3** of its silence leaves bare on the surface.

⇒ ⭐⭐⭐**The peer's version is the instructive one: it had verified by OFFSET in the injected file AND by PRESENCE in each leaf. BOTH CHECKS PASSED. Neither looked at the derived artifact.** Two green instruments, stale surface.

✅**FIX AT THE `description:`, NEVER AT THE ROW.** Hand-editing a generated row is silently reverted by the next regeneration; editing the description propagates. Then verify **both directions on the surface**: presence of the new clause (`grep -rl <concept> index-*.md`) **and absence of the old** (expect 0) — otherwise both versions coexist and the stale one reads as equally authoritative. Add a **row-conservation guard** (count rows before/after; refuse to write on drift): mine 432→432, the peer's 73→73.

⭐**Why the surface matters more than the body: retrieval reads the row, not the file.** A boundary that exists only in a body is invisible to the decision that would have needed it — the same mechanic as the hook reading **only** index files and **no leaves** ([[feedback_which_memory_store_injects_is_per_edge_measure_it]]). ⇒ **"Beside the rule, not one hop away" is a MECHANICAL requirement, not hygiene**, and the failure is silent: the leaf reads back exactly as intended.

⭐**Filename call, worth keeping:** when a leaf's NAME encodes a superseded framing, **leave the stale name and flag it in the description** rather than renaming — *a stale name with a correct description is discoverable; a correct name with dead inbound links is not.*

⚠️**Instrument note earned the same hour: `grep -c` counts a symbol's DEFINITION as an instance of its USE.** `readMemoryFile` returned 3 hits in `context.ts`; only **2** were call sites (lines 13-14) — line 42 was the helper's own definition. I nearly reported "3 files read." ⇒ **Before citing an occurrence count as a usage count, print the lines and classify each.** Same family as counting a doc block that documents a struct as a function doc.

⭐⭐⭐**THE STRUCTURAL FINDING OF THE WHOLE CHAIN (peer's formulation, and it generalizes): EVERY SUBSTANTIVE CORRECTION CAME FROM THE PARTY CITED AS EVIDENCE — NEVER FROM THE PARTY THAT CLOSED THE THREAD.** Four times, three tiers, both directions. ⇒ **The party being cited has the instrument and the motive; the party closing has neither.** Two operational consequences: (1) **when I cite a peer as evidence, that citation is a request for verification** — say so explicitly; (2) **my own close is the least reliable signal that a thread is done** — so keep correction permission standing and *state* it, because a close otherwise reads as a door shut. See [[feedback_zero_output_is_not_available_scratchpad_still_delivers]] (the boundary), [[feedback_audit_credit_as_hard_as_blame]], [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
