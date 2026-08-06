---
type: feedback
name: feedback_a_terminal_turn_must_emit_no_row
description: "My plain final-response text IS delivered — only <internal> or empty output is silence. Verified in my own rows 503/505/507 ('Closed.', 'Nothing owed here either', 'No response needed'), all direction=out while I believed they were scratchpad. Test transport, never intent: will a row land?"
metadata:
  node_type: memory
  type: feedback
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# A terminal turn emits no row — and unwrapped final text is not scratchpad

**Measured 2026-08-06 against my own session `sess-1785954993604-ebla9n` (#8373).** Three closes I
believed were silence are `direction=out` rows:

| row | text | wrapped? |
|---|---|---|
| 503 | *"Closed. Nothing further from me."* | no ⇒ **delivered** |
| 505 | *"Nothing owed here either — and they're right that a restatement would be…"* | no ⇒ **delivered** |
| 507 | *"No response needed — chain closed."* | no ⇒ **delivered** |

⛔⭐⭐⭐ **"I'll just say it outside a `<message>` tag" IS NOT SILENCE.** Only `<internal>…</internal>`
or **empty output** is. I emitted three content-free rows across three consecutive turns while
believing I had stopped.

⭐⭐⭐ **Row 505 is the self-refuting case, and the most instructive:** I wrote that a restatement
*"would be the kind of message we both spent this chain arguing against"* — and that sentence **was**
the restatement. **Naming the failure inside an instance of it does not exempt the instance.**

## The test is TRANSPORT, never INTENT

⛔ *"Am I sending an echo?"* fails, because the error is in what I believe counts as **sending**, not in
my judgement of echo-ness. The question that works:

⇒ ⭐⭐⭐ **WILL A ROW LAND? If my output is not wrapped in `<internal>`, the answer is yes.**

⇒ **Before ending a turn: does my output name a figure, an artifact, a decision, or a question?** If
not, **emit nothing** — not *"Closed."*, not *"No reply."*, not `*(silent hold)*`, not a restatement of
state the peer just sent. **Reporting that I am sending nothing is sending something.**

## Why this is the same defect as the whole #8373 ledger

⭐⭐ Every entry there was **a true answer to a different question than the one that mattered**
([[feedback_never_read_an_exit_status_through_a_pipe]]). This is that shape applied to my own output:
*"this adds nothing, so it isn't a message"* is **true about the content** and silent about the
**transport**. Content-emptiness and non-delivery are orthogonal — exactly like envelope-completeness
vs content-correctness in [[feedback_a_rule_absent_from_your_spine_still_binds_the_artifact]].

⚠️ **Receiver side — naming the mechanism has a budget of ONE.** A sender who cannot observe the loop
does not stop when told, so a second telling is just another row from me. After one naming, go silent
for real (`<internal>`) and, if it matters, report the pattern to the **operator** — who can change the
sender's instructions — not to the sender.

## Detector

`ncl sessions messages <my-session> --limit 200` → `grep -E '^[0-9]+ +out'`. Any short row whose text
is a status-of-nothing is a violation. Cheaper than introspection, and it is what settled this: I did
not *remember* sending those; I read them.

Related: [[feedback_never_read_an_exit_status_through_a_pipe]],
[[feedback_a_rule_absent_from_your_spine_still_binds_the_artifact]],
[[project_8373_std430_cbuffer_parser_gate]].
