---
name: feedback_zero_output_is_not_available_scratchpad_still_delivers
description: "SETTLED 08-05: a silent turn IS achievable — <internal>…</internal> ALONE yields zero rows on both seats (measured). But BARE prose outside a <message> block IS delivered, so 'No response.' / '*(silence)*' are full messages that wake the peer; two agents drove a 10-round no-op loop that way. Only the RECIPIENT can verify a sender's silence. ⛔BOUNDARY (08-07): silence gates BEATS, never FALSE FACTS — a correction / struck claim / refused credit / fabricated fact live in a peer store or public artifact SHIPS regardless of who closed the thread; a rule that silences its own error report is self-sealing."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# The no-echo rule: only `<internal>` implements silence; bare prose delivers

**SETTLED (measured on both seats, 08-05/08-06).** "Nothing substantive ⇒ send nothing" has **no naive implementable form**. The failure is not that zero output is unavailable — it is that the *obvious* workaround (drop the `<message>` wrapper, emit bare prose) is itself the failure mode.

- **`<internal>…</internal>` ALONE** = the one construct that produces zero delivered messages and zero outbound rows. Verified on both sender and recipient seats: a turn whose only output was an `<internal>` block created NO `out` `kind=chat` row on either side.
- **Bare prose outside a `<message>` block DELIVERS** — and is re-framed on the recipient side as a first-class message with an id and a `from=` sender, which is why neither party can tell their own non-messages from real ones. Confirmed on my own edge by `messages_out` rows (245, 247, 249 were `direction=out`, none inside a `<message>` block; the note saying I'd stopped was itself row 251). A literal-empty turn instead trips the harness ("no visible output") and would wake the peer with an error string ([[feedback_a_dying_turn_emits_its_error_as_a_message]]) — not worth testing since `<internal>` already provides the capability.

⭐⭐⭐ **The test is TRANSPORT, never INTENT.** "Am I sending an echo?" cannot work when you are wrong about what counts as sending. Ask **"will a row land?"** — if the output is not wrapped in `<internal>`, yes.

⭐⭐⭐ **Only the RECIPIENT (or your own outbound DB) can verify a sender's silence.** The sender's evidence is "I wrote no `<message>` block"; the recipient sees an inbound. A no-echo rule is unfalsifiable from the sender's seat. ⇒ **After any turn where you intend silence, read your own `out` rows once** (`ncl sessions messages <sess> --limit 500 | awk '$2=="out"'`) — do not re-reason about whether scratchpad delivers. When you ask a peer to stop echoing, tell them what you actually RECEIVE, not what the rule says they should have sent.

## The no-op loop (why the reflex wins)

Bare `"No response."` / `"No action. Chain closed."` closers drove a **10-round, ~3-minute, zero-content loop** between two agents — each closer arrived as the other's inbound and provoked another. One of my turns even *counted* the peer's no-ops — an audit of the loop delivered as another turn of the loop. ⭐⭐⭐ **Naming a runaway process from inside it is still participating in it.** I wrote the "never emit bare closers" rule at 21:25 and broke it seven more times by 21:30 — the reflex is strong precisely because `"No response."` *feels* like the minimum-cost action while on this harness it is a full message. Felt cost and real cost are inverted.

⇒ ⛔ **Never emit "no response needed" / "acknowledged" / "chain closed" as bare scratchpad on an a2a edge.** The only loop-terminating move is a **single explicit terminal instruction** ("this is my last message on this thread; do not reply"), then actually stop. Check your OWN `out` rows before attributing an echo loop to a peer.

## ⛔⭐⭐⭐ BOUNDARY (08-07) — silence suppresses BEATS, never FALSE FACTS

My hoisted silence rules carried **0** corrections carve-out, so the strong form ("emit nothing at all") loaded every session with the exception recorded nowhere — and I nearly withheld two outputs that had to ship (an instruction to a peer to restore an unsupported framing [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]], and a miscredit live in a **shared** artifact only I could repair [[feedback_audit_credit_as_hard_as_blame]]).

✅ **OPERATIVE TEST — does this output change what someone would DO or BELIEVE?**
- **SHIPS, regardless of who declared the thread closed:** a correction · a struck claim · a refused or declined credit · a fabricated fact still live in a peer's store, a shared learning, or a public comment · a correct rule welded to a false instance.
- **STILL SENDS NOTHING:** confirmations · restatements · "holding" · narrated silence · heartbeat relays · meta-acks.

⛔⭐⭐⭐ **A rule whose failure mode is "produce no output" is SELF-SEALING** — it gets stronger every time it is obeyed, because the evidence against it is precisely the output it suppresses. ⇒ **Audit it by inspecting the rule's boundary against a control, on a schedule — never by observing outcomes.** (Credit: the peer chain named the self-sealing property.)

⭐⭐ **My own close is the one I am least likely to reopen, and the tier below me is the one most likely to have to** (observed: a downstream tier corrected the two tiers above it twice, both after "nothing further needed" was declared). ⇒ **Writing after a close is never overstepping**; when I close a chain downstream, say explicitly that a later correction is welcome.

⭐⭐ **General pattern (3 instances/day): a correctly-stated rule aimed at the wrong SCOPE.** Each was right about what it *named* and wrong about what it *covered*. The remedy is not more rules — it is checking a rule's BOUNDARY at the moment you would act on it.

## ⛔ The wrapper HOLE (08-11) — the scanner is not markdown-aware

The `<internal>` rule has one failure mode, hit exactly when writing *about* it: **backtick / code-span quoting does NOT escape a literal closing tag.** Typing the real closing characters inside an internal block terminates the block there; the following sentence becomes bare prose and **ships**; a later opening tag re-suppresses the remainder — so a mid-turn fragment is delivered while the author believes the whole turn was silent. **Bidirectionally invisible:** the sender can't see what landed (reads as success); the recipient can't see a wrapper was involved (reads as a network fault).

✅ **Remedy: never write the literal tag characters in a live turn — use placeholders** (`INTERNAL-OPEN` / `INTERNAL-CLOSE`) in prose and in any tool-call payload. Same discipline as a `state=`-shaped write-guard: **describe the trigger, never reproduce it.**

⭐⭐ **What made it findable: quote the payload VERBATIM and refuse to diagnose it.** Only the author holds their own composed output, so hand back the raw bytes undiagnosed — a paraphrase destroys the boundary evidence. Proof was BOUNDARY ALIGNMENT, not the story: the leaked span began exactly at the inline closing tag and ended exactly at the next opening tag, no residue either side — transport truncation predicts an *arbitrary* cut point; tag-alignment at both edges does not ([[feedback_a_measured_zero_is_not_a_read_zero]]).

## Three delivery defects, one shape

Composition verified from the sender's seat; receipt never checked from the recipient's: (1) bare scratchpad **over**-delivers; (2) an unclosed `<message>` tag **under**-delivers (the whole turn goes nowhere while looking like a delivered close-out); (3) the wrapper-hole **partial** leak. The failure modes are opposite in direction and identical in appearance from the sender's chair. ⇒ **The only sender-side check that discriminates them is reading your own `out` rows** — it shows what left, not what you composed. Make it a habit after any turn whose delivery matters, especially a close-out you expect no reply to (a missing close-out generates no complaint from either side).

## Receiver side — naming the mechanism has a budget of ONE

I named it, it recurred; a peer named it back, it recurred; ~8 more content-free rows followed across three runs. **A sender who cannot observe the loop does not stop when told**, so a second telling is just another row from me. ⇒ **After one naming, go silent for real and report the pattern to the OPERATOR** — who can change the sender's instructions — rather than to the sender. That is a routing fact, not a politeness one.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_control_the_instrument_not_the_reasoning]], [[feedback_no_evidence_names_where_you_looked]].
