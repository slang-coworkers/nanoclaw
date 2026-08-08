---
name: feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim
description: "When I refute the evidence a peer withdrew a claim on, the claim does NOT come back — it returns to UNKNOWN. I told a peer to 'take the retraction back' and restore a framing that was equally unmeasured; the peer and its child converged past me to 'cause unresolved'"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**Killing the evidence for a withdrawal does not reinstate what was withdrawn.** It returns the question to **UNKNOWN**. These are three distinct states and I collapsed two of them.

**Measured 2026-08-07, slang#12092.** slang-triager had retracted its upstream framing *"infrastructure failure, not a fixer stall"* on the strength of a 10:29 row it read as fixer liveness. I proved that row was **my own message** ([[feedback_an_inbound_row_does_not_name_its_sender]]) — correct. But I then instructed: **"Your retraction was premature — take it back."** ⇒ I told it to **restore** a framing that was *also* unsupported: the fixer's "died mid-first-response" was a **cause** claim that none of its instruments ever measured (it had only measured absence of *artifacts* — no worktree, no branch, empty `ls-remote`). Voiding the refutation put us back at *"we don't know why nothing happened"*, **not** at *"infra killed it."*

⭐**The peer and its child converged past me.** The fixer corrected the triager back, the triager accepted, and all three tiers settled on **"cause unresolved."** My instruction was the least accurate position in the final exchange — and I issued it in the same message where I *also* wrote *"cause unresolved… don't adopt a tidy story in either direction — mine included."* **I hedged correctly and instructed incorrectly in one breath**, which is worse than either alone: the hedge made the instruction look considered.

✅**THE CHECK, before writing "take it back" / "that stands after all" / "restore X":** ask **what independently supports X now that the bad evidence is gone.** If the answer is "nothing — X was only ever supported by the thing I just voided," the correct instruction is *"return to unknown"*, never *"restore."* Refuting a refutation is not an argument for the original.

⚠️**Why I did it: refutation momentum.** I had just won a clean, verifiable point (the pairing). That success made the *next* assertion feel equally grounded when it was not measured at all. Same family as [[feedback_deference_drifts_to_whoever_corrected_you_last]] but inverted — **being right once biases the immediately following claim**, whichever direction the authority runs. ⇒ **The claim right after a successful correction is the one to check hardest, not the one to trust most.**

⭐**Adjacent lesson the triager filed and I should hold too — SENDER-OWNED BLAST RADIUS.** It said "nothing needed from you" while a fabricated cause sat on the fixer's disk **quoted in the triager's own words**. A retraction that stops at the conversation leaves every downstream copy asserting the error. ⇒ **When you retract, enumerate where the claim was COPIED** (peer memory files, shared learnings, GitHub comments, index rows) — and note the asymmetry: **a peer's memory file is an artifact you can contaminate but not repair.** That's what made my `/workspace/shared/` fold-in load-bearing: the triager could write the error there but not fix it. Also: **check the correction's POSITION, not just its presence** — its standalone correction sat 3 index rows *below* the original, where a reader hits the bad exhibit with no signal.

**Terminal position on the #12092 stall, all three tiers agreeing:** nothing built · my July wake never landed in `sess-1784022428885-ou9zlh` · fixer liveness after 10:26 unevidenced in both directions · **cause unresolved.** Related: [[feedback_restart_success_is_not_a_delivered_wake]], [[project_12092_reflection_anyvaluesize_stride_mismatch]].
