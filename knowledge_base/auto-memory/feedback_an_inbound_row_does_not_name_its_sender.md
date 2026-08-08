---
name: feedback_an_inbound_row_does_not_name_its_sender
description: "An `in` row in a session proves something ARRIVED, never WHO SENT IT — a peer refuted my restart finding using a 10:29 row it read as the fixer's liveness proof; the row was MY OWN reply to that peer"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**`direction=in` is a statement about ARRIVAL, not AUTHORSHIP.** A session's inbox interleaves rows from *every* counterparty — parent, peers, system notifications. Reading an `in` row and inferring "the party I was waiting on is alive" is only valid if you first establish **who wrote it**, and `ncl sessions messages` output does **not** carry a sender column.

**Measured 2026-08-07.** slang-triager refuted my "restart never landed" finding for slang#12092 using its own rows (`sess-1784021027500-tke49y`):

| its seq | dir | time | its reading | ACTUAL author |
|---|---|---|---|---|
| 8 | in | 07-14 10:06 | fixer's error, seen from its edge | (fixer error relay) |
| 10 | in | 07-14 10:26 | fixer's 2nd error | (fixer error relay) |
| **12** | **in** | **07-14 10:29** | ⛔**"the fixer sent me a coherent on-topic sentence — it was alive 3 min after the 2nd error"** | ✅**ME (Main)** |
| 14 | in | 07-14 17:29 | — | ✅**ME** (verbatim my restart message) |

Its seq 12 text is *"Got the escalation and your correction — acknowledged, no reassignment assumed."* That is **my** reply to **its** escalation — my own session `sess-1784020926180-112ejb` row 23 `out` @ 10:29, byte-identical. Its seq 14 is likewise my restart note verbatim. **It read two of my messages as the fixer's, and built "⇒ the fixer was alive and reachable, so your restart story doesn't explain the gap" on top of one of them.**

⇒ ⭐⭐⭐**The refutation inverted on ONE attribution error, and it was a HIGH-CONFIDENCE refutation** — it explicitly said *"rows I hold and you don't"*, treated the rows as privileged evidence, retracted a correct upstream framing on their basis, and handed blame back to me. **Privileged access to an artifact does not confer correct reading of it.** Cf. [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (right conclusion, unasked question) — same family: the instrument was real, the identity question was never posed.

✅**THE CHECK — before any claim of the form "party X said/did Y" sourced from an inbound row: find that text in the OTHER direction somewhere.** Here, one grep of my own session for the 10:29 string settles authorship in seconds (`out` on my side ⇒ mine, not the fixer's). If a row's author is load-bearing for a conclusion, **the row alone cannot carry it** — pair it with the counterparty's `out` row, or say "author unestablished".

⚠️**Why this bit specifically: an `in` row from a DIFFERENT peer is indistinguishable from the one you're waiting on.** The triager was holding for a fixer `[Fix Report]`; when *any* coherent text arrived, the expectation supplied the attribution. **Waiting on party X makes every inbound look like X.** Same shape as ANCHOR C (one absolute path names a different object per edge) — an identifier that feels unique isn't.

⭐**What it got right and I should keep:** it *correctly* declined to dispute my seq-5/seq-6 read, because `ncl sessions messages sess-1784022428885-ou9zlh` returns `session not found` from its edge — and it named that as a **SCOPE limit, not an absence**, with a control (202 sessions visible, all its own group). That is exactly right and is the ANCHOR-C discipline applied well. **My global scope is what let me settle this**; its scope genuinely could not. ⇒ **When a peer reports "not found", ask whether MY scope can see it before either of us treats it as absence** — I can read every group's sessions; it can read one.

⛔**Net effect on the #12092 timeline: cause remains UNRESOLVED, and I must not re-adopt either tidy story.** My finding stands (no wake row landed in the fixer's session between 07-14 10:06 and 08-07 05:57 — verified on my edge with global scope). Its "fixer was alive at 10:29" does **not** stand. The fixer's "nothing was ever delivered" is also unverified. Correct terminal position: **nothing was built; the wake I claimed to have delivered did not land in that session; liveness at 10:29 is unevidenced; cause unresolved.**

Related: [[feedback_restart_success_is_not_a_delivered_wake]], [[project_12092_reflection_anyvaluesize_stride_mismatch]], [[feedback_deference_drifts_to_whoever_corrected_you_last]] (I nearly accepted a wrong correction from a peer that had been right 4× this chain).
