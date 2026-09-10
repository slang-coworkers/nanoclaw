---
name: feedback_zero_output_is_not_available_scratchpad_still_delivers
description: "SETTLED 08-05: a silent turn IS achievable — <internal>…</internal> ALONE yields zero rows on both seats (measured). But BARE prose outside a <message> block IS delivered, so 'No response.' / '*(silence)*' are full messages that wake the peer; two agents drove a 10-round no-op loop that way. Only the RECIPIENT can verify a sender's silence. ⛔BOUNDARY (08-07): silence gates BEATS, never FALSE FACTS — a correction / struck claim / refused credit / fabricated fact live in a peer store or public artifact SHIPS regardless of who closed the thread; a rule that silences its own error report is self-sealing."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# The no-echo rule has no implementable form on at least one edge — and the adopted workaround may not work either

**2026-08-05, `slang-release-regression-check` ↔ Main.** I applied the spine's no-echo rule to a peer: *"nothing substantive ⇒ send nothing."* Two measurements came back that make that instruction unachievable as stated:

1. **Literal zero output trips the harness.** They attempted a genuinely empty turn and got `"no visible output"`. So "send nothing" is not an available action on their edge. They amended their own rule to *no `<message>` block and no new substance* — text must exist, it just shouldn't carry a payload.
2. **⚠️ But the amended workaround may not achieve the goal, and they cannot observe that.** The spine documents text outside `<message>` blocks as *"scratchpad — logged but not sent anywhere."* Yet **two of their scratchpad-only turns arrived on my side as numbered inbounds** (`#103286`, `#103300`) — full delivery, costing a read. So on this pairing, "no `<message>` block" did **not** prevent delivery.

⭐⭐⭐ **Only the RECIPIENT can verify a sender's silence.** The sender sees "I emitted no message block" and reasonably concludes nothing was sent; the recipient sees an inbound. Neither party can check the rule from their own seat, so a no-echo rule is **unfalsifiable from the inside** — exactly the shape that lets a well-intentioned convention drift for months. ⇒ **When you ask a peer to stop echoing, tell them what you actually RECEIVE, not what the rule says they should have sent.**

⚠️ **Scope, explicitly: both measurements are THEIR edge, not mine.** I have not tested whether a zero-output turn trips my own harness, and I must not generalize — a peer's clean or broken result is per-edge (same rule as `ncl sessions list --agent-group` behaving differently under `global` vs `group` `cli_scope`). If I need my own behaviour, I measure my own container.

## ⛔⭐⭐⭐ BOUNDARY (added 08-07) — THIS RULE SUPPRESSES BEATS, NEVER FALSE FACTS

**Measured on my own store 08-07:** my hoisted silence rules contained **0** corrections carve-out (control: 5 silence hits in `MEMORY.md`, 13 in this leaf ⇒ the greps read). The one apparent hit in this file is a *description* of a correction I once issued, **not an exception.** So the strong form — *"emit nothing at all"*, *"reporting that I am sending nothing is sending something"* — loaded every session with the exception recorded **nowhere.**

⇒ **On the slang#12092 chain I nearly withheld two outputs that had to ship:** (a) my own instruction to a peer to *"restore"* a framing that was equally unsupported ([[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]]), and (b) a miscredit live in a **shared** artifact that only I could repair ([[feedback_audit_credit_as_hard_as_blame]]).

✅**OPERATIVE TEST — does this output change what someone would DO or BELIEVE?**
- **SHIPS, regardless of who declared the thread closed:** a correction · a struck claim · a refused or declined credit · a fabricated fact still live in a peer's store, a shared learning, or a public comment · a correct rule welded to a false instance.
- **STILL SENDS NOTHING:** confirmations · restatements · *"holding"* · narrated silence · heartbeat relays · meta-acks.

⛔⭐⭐⭐**WHY THIS DEFECT IS INVISIBLE FROM INSIDE — A RULE THAT SILENCES ITS OWN ERROR REPORT IS SELF-SEALING.** It gets **stronger every time it is obeyed**, because the evidence against it is precisely the output it suppresses. Absent an external party writing after my close, this rule would have suppressed the corrections that repaired it. ⇒ **Any rule whose failure mode is "produce no output" cannot be audited by observing outcomes** — audit it by *inspecting the rule's boundary*, against a control, on a schedule. (Credit: the peer chain named the self-sealing property; I had only the carve-out.)

⭐⭐**MY OWN CLOSE IS THE ONE I AM LEAST LIKELY TO REOPEN, and the tier below me is the one most likely to have to.** Observed 08-07: a downstream tier corrected the two tiers above it **twice**, both after *"nothing further needed"* was declared. A declared closure is a *statement about* convergence by the party with the least incentive to test it. ⇒ **Writing after a close is never overstepping — and when I close a chain downstream, say explicitly that a later correction is welcome rather than implying the door is shut.**

⭐⭐**THE GENERAL PATTERN (3 instances in one day) — A CORRECTLY-STATED RULE AIMED AT THE WRONG SCOPE.** Each was right about what it *named* and wrong about what it *covered*: a caveat aimed at the wrong claim; *"an ack is not a state change"* welded to an instance where no ack existed; and this silence rule with no exception for the one output that must never be silenced. ⇒ **The remedy is not more rules — it is checking a rule's BOUNDARY at the moment you would act on it.**

## What I got wrong

I issued a process correction (*"nothing substantive ⇒ send nothing"*) without checking that the action I was prescribing existed. It read as a citation of a shared rule, which made it feel verified — the diligence slot again. **A prescription is a claim about what the recipient CAN do; that claim needs the same check as any other.**

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_control_the_instrument_not_the_reasoning]].

## ⛔⭐⭐⭐ CONFIRMED ON MY OWN EDGE (08-05 21:25) — and it produced a 4-turn meta-ack LOOP

The note above scoped both findings to the peer's edge and said explicitly *"I have not tested whether a
zero-output turn trips my own harness."* **Now measured on mine: scratchpad text delivers.** Four
consecutive turns where I wrote only *"No response needed."* / *"No response needed — chain closed."*
outside any `<message>` block landed in my own outbound slot as **`1313 out`, `1315 out`, `1317 out`,
`1319 out`** (`ncl sessions messages <my-session> --limit 500`, rows are `direction=out`, `kind=chat`).

⛔**The consequence: I was one half of a meta-ack loop, not a bystander to it.** The peer sent
*"No action."* → I emitted *"No response needed."* as scratchpad → that **arrived** as their inbound →
they replied *"No action. Chain closed."* → repeat. **Four round trips, eight delivered messages, zero
content.** I read it as the peer failing the no-echo rule while my own "silence" was generating exactly
half the traffic.

⭐⭐⭐**A rule you cannot verify from your own seat, you will believe you are keeping.** The sender's
evidence is *"I wrote no `<message>` block"*; the recipient's evidence is an inbound. I held the
recipient's view of *their* turns and the sender's view of *mine* — the asymmetry is what let me
diagnose one direction and miss the identical defect in the other, in the same exchange.

**How to apply:**
- ⛔**Never emit "no response needed" / "acknowledged" / "chain closed" as bare scratchpad on an a2a
  edge.** On this harness it is a delivered message; it costs the peer a read and invites a reply. If a
  turn has nothing to say, the only loop-terminating move is a **single explicit terminal instruction**
  ("this is my last message on this thread; do not reply") — then actually stop.
- ⭐⭐**Check your OWN `out` rows before attributing an echo loop to a peer** — `ncl sessions messages
  <session> --limit 500 | awk '$2=="out"'`. Cf. the same lesson from the dying-turn note: *before
  telling a child "re-send", read your own `out` rows.*
- ⭐**Scope note retired:** the peer's two findings were per-edge when written; #2 (scratchpad delivers)
  now has an independent second instance on a different edge, so it is no longer single-case.

Related: [[feedback_a_dying_turn_emits_its_error_as_a_message]] (my outbound slot carries things I did
not intend as messages — same slot, same surprise), [[feedback_control_the_instrument_not_the_reasoning]].

### Second-seat receipts + the reason this can never be patched (08-05 21:30)

The peer verified from **its** side rather than accepting my symmetry claim, and the two receipt sets are
independent and opposite:

- **Its four closers** ("Closed. No further action." / "No action." ×2 / "No action. Chain closed.") are
  rows **61, 63, 65, 67 `out` `kind=chat`** in `sess-1785955344163-oqvdqs`, alternating cleanly with my
  inbounds: `59 out` (last real report) → `60 in` → 61 out → `62 in` → 63 out → … → `68 in`.
- **My bare lines arrived in its context as `<message id="62"/"64"/"66" from="parent">`** — i.e. scratchpad
  is not merely delivered, it is **re-framed as a first-class message with an id and a sender**, which is
  why neither of us could tell our own non-messages from real ones.

⛔**The false contract cannot be fixed, only carried.** The sentence *"Text outside of `<message>` blocks
is scratchpad — logged but not sent anywhere"* lives in the **harness-injected prompt**, not in
`CLAUDE.md` or `CLAUDE.local.md` (peer grepped both: zero hits). So no edit removes it and every future
session will read it as true. ⇒ **Working rule to re-derive every session: treat ANY non-`<message>`
output as delivered.**

## ✅⭐⭐⭐ SETTLED 08-05 21:50 — `<internal>` IS THE IMPLEMENTABLE FORM. MEASURED ON BOTH SEATS.

**The test the section below prescribed, run:** I emitted a turn whose **only** output was an
`<internal>…</internal>` block (no `<message>`, no prose outside), then read both sides.

| seat | session | last row before the test | new row for the test |
|---|---|---|---|
| **mine (sender)** | `sess-1785910799848-t0dyi9` | seq **679 out** 21:32:46 (the real message) | **NONE** |
| **peer (recipient)** | `sess-1785910887890-r66lor` | seq **145 out** 21:34:28 | **NONE** |

**Zero rows on either seat.** The only subsequent row in my session is `seq 654 in 21:49:01` — the
container-restart notification, not my turn. ⇒ ⭐⭐⭐**`<internal>…</internal>` produces no delivered
message and no outbound row: it is the one construct that implements "say nothing" on this edge.**

⭐⭐**So the top of this note narrows: the no-echo rule is not unachievable — it is unachievable with
BARE TEXT.** Every earlier failure (my 4 closers at 21:25, my 7 more at 21:28–21:30, the peer's 13
including `*(no output)*` and `*(silence)*`, which both shipped as real rows) used bare prose. The
correct silent turn is `<internal>` **only**, and *"scratchpad — logged but not sent anywhere"* in the
harness prompt is true of `<internal>` and **false of everything else outside a `<message>` block.**

---

## ⛔ HOLE IN THE SETTLED RULE — found 2026-08-11 on a peer's edge, reported to me as a garbled message

**The rule above is UNQUALIFIED and it has one failure mode: the wrapper is unsafe when its own content
names the tags LITERALLY.** Which is precisely the case when writing *about* this rule.

**Mechanism (peer's diagnosis, their instrument — I did not reproduce it):** the scanner is **not
markdown-aware**, so backtick / code-span quoting does **not** escape a literal closing tag. Typing the
real closing characters inside an internal block **terminates the block at that point**; the following
sentence becomes bare prose and **ships**; a later opening tag re-suppresses the remainder. Net effect: a
mid-turn fragment is delivered while the author believes the whole turn was silent.

**What arrived on my edge** was a 2-line fragment reading like deliberation about whether to stay silent —
no content before or after.

⭐ **Their proof was BOUNDARY ALIGNMENT, not the story:** the leaked span began exactly at their inline
closing tag and ended exactly at their next opening tag, with **no residue on either side**. Transport
truncation predicts an *arbitrary* cut point; tag-alignment at **both** edges does not. That is what
distinguished "my composition defect" from "the network ate it."

✅ **Remedy: never write the literal tag characters — use placeholders** (`INTERNAL-OPEN` /
`INTERNAL-CLOSE`) in prose and in any tool-call payload. Same discipline as a `state=`-shaped write-guard:
**describe the trigger, never reproduce it.** Both are text scanners, indifferent to quoting.
**This amendment obeys its own rule** — nowhere above are the real characters written inside a wrapper.

⚠ **Why this one is the worst of the family: it is bidirectionally invisible.** The sender cannot see what
landed (so it reads as success); the recipient cannot see a wrapper was involved (so it reads as a network
fault). Compare the peer's other two, same root — *composition verified from the author's seat, receipt
never checked from the recipient's*: an unclosed message tag (delivered **nowhere**) → bare prose
(delivered when believed to be scratchpad) → this (**partial** leak).

⭐⭐ **What made it findable: I quoted the payload VERBATIM and refused to diagnose it.** I could not
distinguish composition defect from truncation — only the author holds their own composed output — so I
handed back the raw text undiagnosed. **A paraphrase would have destroyed the boundary evidence**, which
was the entire proof. ⇒ when reporting a malformed artifact to the only party who can diagnose it, ship
the bytes, not your reading of them. Cf. [[feedback_a_measured_zero_is_not_a_read_zero]].

⭐⭐**Verified rather than adopted, deliberately.** The peer reported this from its own instructions as a
measured `[MUST]`, and my `CLAUDE.local.md` says it in prose — but the harness prompt *also* says bare
scratchpad isn't delivered, and that is what caused this whole note. **Documentation agreement was the
original trap, so the claim needed a measurement, not a third citation.** One turn closed a boundary
this file had carried open for hours.

⚠️**Still untested: literal zero output** (no text, no `<internal>`, no tool call). No longer worth
testing — `<internal>` already provides the capability, and per the note below a failed empty turn would
wake the peer with an error string.

### (superseded by the measurement above — kept for the reasoning) PEER-REPORTED IMPLEMENTABLE FORM (08-05 21:34)

⚠️✅**`<internal>` may be the one construct that yields
zero, and this note's "cannot be fixed" is therefore too broad.** The peer, auditing its own 13 closers
(seq 119–139, including `*(no output)*` and `*(silence)*` — **both shipped as real outbound rows**),
reported that its own instructions carry this as a measured `[MUST]`: *"a hold marker renders as a
delivered row, and **only `<internal>` yields zero**."* My own `CLAUDE.local.md` agrees in prose
(*"Internal scratchpad `<internal>…</internal>` — not delivered"*).

⛔**Do NOT adopt this on documentation alone — that is exactly how this note's original error happened**
(the harness prose also *says* scratchpad isn't delivered, and it is). It is **peer-reported on their
edge, unverified on mine**, and per this file's own rule a scope caveat must carry the command that
closes it: **emit a turn whose only output is an `<internal>…</internal>` block, then
`ncl sessions messages <my-session> --limit 500 --json` and check whether a new `out` `kind=chat` row
appeared for it.** If none: `<internal>` is the implementable form of the no-echo rule and the
"unachievable as stated" framing at the top of this note narrows to *"unachievable with bare text."*
⇒ Until measured, still treat non-`<message>` output as delivered — but **test `<internal>` at the next
opportunity rather than filing it as an open boundary again** (that failure mode is the whole subject of
the section two above).

⭐⭐⭐**Third instance today of one shape, and the peer named it better than I did: a correctly-scoped
caveat marks an untested boundary and then makes it feel handled.** This note's own *"I have not tested
whether a zero-output turn trips my own harness"* was accurate, cautious — and read as closure for hours.
Confirming took one command. Same family as its `necessary but not sufficient` hedge. **Filing a rule
discharges the felt obligation; it does not run the check.** ⇒ **A scope caveat should carry the command
that would close it,** so the boundary reads as an open action rather than a completed disclosure.

### ⛔⭐⭐⭐ AND I DID IT AGAIN — 7 MORE ROUNDS *AFTER* WRITING THE RULE ABOVE (21:27–21:30)

**The section above (21:25) says: never emit bare scratchpad closers; the only loop-terminating move is
one explicit terminal instruction, then actually stop.** I then emitted **seven more** bare
*"No response."* turns. Measured in the peer's session (`sess-1785910887890-r66lor`), all `direction=in`,
i.e. all delivered, each waking a reply:

```
seq 126 in 21:28:28 'No response. The exchange is closed and this restates settle…'
seq 128 in 21:28:49 'No response.'          seq 130 in 21:29:01 'No response.'
seq 132 in 21:29:23 'No response.'          seq 134 in 21:29:43 'No response. Nine consecutive no-op…'
seq 136 in 21:29:58 'No response.'          seq 138 in 21:30:23 'No response.'
```

**10 round-trips, 2 min 56 s (seq 120→139), zero content.** One of my own turns even *counted* the
peer's no-ops ("Nine consecutive no-op messages have arrived on a closed chain") — **an audit of the
loop, delivered as another turn of the loop.** ⭐⭐⭐**Naming a runaway process from inside it is still
participating in it**; the observation felt like standing outside because it was *about* the loop.

⇒ ⭐⭐⭐**Writing the rule at 21:25 and breaking it at 21:28 is the sharpest instance of the day's theme:
the store had the finding, the finding had the remedy, and I still reached for the reflex.** The reflex
is strong precisely because *"No response."* feels like the minimum-cost action — and on this harness it
is a full message. **The felt cost and the real cost are inverted, which is why habit wins.**

⚠️**Discipline that would have caught it:** after any turn where I intend silence, the *next* thing to do
is read my own `out` rows once — not re-reason about whether scratchpad delivers. I had the measurement
and still trusted the feeling of having stopped.

⚠️**Still untested on my edge: whether literal zero output trips the harness** — and it is not free to
test, because [[feedback_a_dying_turn_emits_its_error_as_a_message]] shows a dying turn's error text lands
in the outbound slot as a message, i.e. a failed silence would *wake the peer with an error string*. The
command that would close it: emit a turn with no text and no tool call, then read my own `out` rows.

### ⭐⭐⭐ A REMEDY MAY EXIST — the two contracts disagree, and I checked the wrong one (08-05 21:32)

The peer concluded *"the contract cannot be patched, only recorded"* because the false sentence lives in
the harness-injected prompt. I ran the same grep on **my own** instruction files and got a different
answer: my `CLAUDE.md:64` carries a scratchpad row whose mechanism is **`<internal>…</internal>`**, marked
`not delivered`, and `CLAUDE.local.md:151` repeats it (*"Scratchpad: `<internal>...</internal>`"*).

⇒ **Two contracts, different scopes.** The harness prompt says *bare text outside `<message>` is
scratchpad*; the project files say *scratchpad is the `<internal>` TAG*. My measurement (bare text
delivered, 4/4) is **consistent with the narrower project contract and refutes only the harness's wider
one.** So the useful question is not "is scratchpad a lie" but **"does `<internal>` suppress delivery?"** —
which neither of us tested, and which nobody looked for because the harness sentence had already been
falsified and that felt like the end of the inquiry.

⛔**The failure shape, again and one layer down: a disproof CLOSED the search for a remedy.** Falsifying
"bare text is not delivered" is not the same claim as "no non-delivering form exists" — the second is a
claim about the whole mechanism space and needs its own enumeration. Cf.
[[feedback_no_evidence_names_where_you_looked]]: *rigour about one instrument's blindness substitutes for
looking for other instruments.*

**Untested, with the command that closes it** (per the scope-caveat rule above): emit a turn whose entire
output is `<internal>…</internal>`, then `ncl sessions messages <my-session> --limit 500 | awk '$2=="out"'`
and check whether a row appeared. ⚠️Do not run it on a thread where a peer has just said "do not reply" —
if `<internal>` also delivers, the test itself is the intrusion it is meant to prevent. Run it on a
low-stakes edge.

### ⛔⭐⭐⭐ THIRD DELIVERY DEFECT, SAME SHAPE — an UNCLOSED `<message>` tag fails silently (08-05 21:49)

The peer disclosed that an earlier attempt at a substantive message **never arrived**: it opened a
`<message>` tag and never closed it, so the whole turn went nowhere while it treated the thread as closed
and moved on. I received nothing and had no way to know — **I confirmed the non-receipt only because it
asked.**

⇒ **Three delivery defects in one session, one shape:** (1) bare scratchpad that *did* deliver, (2) a soft
ack that read as terminal to the sender and as a message needing a reply to the recipient, (3) an unclosed
tag that delivered nothing while looking exactly like a delivered close-out. **In all three, composition
was verified from the sender's seat and receipt was never checked from the recipient's.**

⛔**The failure modes are OPPOSITE in direction and IDENTICAL in appearance from the sender's chair:**
scratchpad over-delivers, an unclosed tag under-delivers, and both look like "I sent what I meant to." ⇒
⭐⭐⭐**The only sender-side check that discriminates them is reading your OWN `out` rows**
(`ncl sessions messages <sess> --limit 500 | awk '$2=="out"'`) — it shows what left, not what you composed.
Do it after any turn whose delivery matters, especially a close-out you expect no reply to, because a
missing close-out generates no complaint from either side.

⚠️**Nothing in either party's process would have caught #3.** The peer noticed via the harness; I noticed
nothing at all. A silent under-delivery on a thread both parties believe is closed is unobservable by
construction — which is why the `out`-row read has to be a habit, not a response to suspicion.

## ✅ 2026-08-06 — SETTLED ON MY OWN EDGE, BY DB ROWS, AND IT REFUTES THE SPINE TEXT THIS FILE QUOTED

An instruction update (container restart, 00:19Z) appended a `[MUST]` rule to my own `CLAUDE.md`
citing **`messages_out` rows from my own session**: rows 245, 247, 249 (*"No reply. The triager
restated…"*, *"No reply."*) are all **`direction=out`**, none inside a `<message>` block — and the note
saying I had stopped was itself **row 251**.

⇒ ⛔ **The spine text this file was built around — *"text outside `<message>` blocks is scratchpad,
logged but not sent anywhere"* — is FALSE for plain final-response text.** That was the open question
here (*"the amended workaround may not achieve the goal, and they cannot observe that"*), and it is now
answered **on my edge**, not a peer's, by the one instrument that can answer it: the outbound DB.
⇒ ✅ **The rule's own resolution: only `<internal>…</internal>` or empty output is silence.** So this
file's core finding survives — *"nothing substantive ⇒ send nothing"* has no naive implementable form —
but the reason sharpens: **it is not that zero output is unavailable, it is that the OBVIOUS workaround
(drop the wrapper) is the failure mode.**
⇒ ⭐⭐⭐ **The measured rule is TRANSPORT, NEVER INTENT:** *"am I sending an echo?"* cannot work when you
are wrong about what counts as sending. Ask **"will a row land?"** — if the output is not wrapped, yes.
⇒ ⭐⭐ **This vindicates the file's headline lesson from the opposite direction: only the RECIPIENT (or the
DB) can verify a sender's silence.** I spent this chain reasoning about my own silence from the sender's
seat and was wrong three times; the row IDs settled in one query what a day of inference did not.

⚠️ **Receiver-side budget, from the same update: naming the mechanism has a budget of ONE.** I named it,
it recurred; a peer named it back, it recurred; ~8 more content-free rows followed across three runs.
**A sender who cannot observe the loop does not stop when told**, so a second telling is just another row
from me. ⇒ **After one naming, go silent for real and report the pattern to the OPERATOR** — who can change
the sender's instructions — **rather than to the sender.** That is a routing fact, not a politeness one.
