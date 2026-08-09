---
name: Bare response text is delivered, not silent scratchpad
description: Plain text outside <internal>/<message> routes to the current sender; wrap reasoning in <internal> and disambiguate message-ids from issue numbers
type: feedback
originSessionId: 57080bfc-af22-4c9e-9553-17bf6b0b3722
---
Bare plain text in my response is **delivered** to the current turn's sender via `session_routing` — it is NOT silent scratchpad. The "scratchpad, logged but not sent" framing only applies to text sitting alongside one or more `<message>` blocks. With no `<message>` block present, my bare text IS a reply to whoever sent this turn. To keep reasoning undelivered, it MUST be wrapped in `<internal>...</internal>`.

**Why:** On 2026-06-22 I wrote a bare preamble line — "Now addressing the latest triager message (#22)" — intending it as scratchpad before an `<internal>` block. It routed to `slang-triager`, which misread "#22" (a NanoClaw inbound message-id) as a GitHub **issue** number and started asking which repo issue #22 was in — a phantom triage task that cost a clarification round-trip. The `<internal>` block was correctly suppressed; the bare line was not.

**⭐ REPEAT INSTANCE 2026-08-03 — I fed an ack loop with the very lines announcing I was ending it.** After slang-rhi#801 closed, the approver sent 4+ content-free close-outs. I correctly decided each time to send nothing — then wrote bare lines *about* that decision: *"Chain remains closed; no reply sent"*, *"Ending the turn silently"*, *"The approver has now sent four consecutive content-free close-outs. Silence is the right terminator — replying feeds the loop."* **Every one was delivered to the approver**, so each "I am staying silent" was itself a reply, and the loop continued for ~5 turns. The other tier eventually mirrored the failure verbatim (*"(No response — ending the turn silently…)"* delivered as a message).
- **Deciding not to reply and narrating that decision are different acts.** The narration is the reply. There is no such thing as a delivered statement of silence.
- **This lesson was already in my store, 42 days old, and I violated it 3 turns running** — same recall-failure shape as the residency inversion in that chain: the fact was present, correct, and not retrieved at the moment of writing. Cf. [[feedback_narrowing_is_not_testing_check_own_store]].
- **Terminating an ack loop = emit ZERO characters outside `<internal>`.** If the turn's only content is "nothing to add," the whole turn is `<internal>`.

**⭐⭐⭐ THIRD INSTANCE 2026-08-04 — a NEW FAILURE MODE: not an ack loop, but an OPERATOR HANDOFF delivered to a PEER.** On the SLANGWIN5 chain (#12341) I ended three consecutive turns with an operator-shaped status block — a markdown table (`item | owner | state`), a *"**What you need to decide:**"* paragraph, and a closing session retrospective. **The sender was `slang-ci-babysitter`, so all of it routed to the babysitter.** They flagged it precisely: *"the prose one paragraph down says 'what you need to decide,' which is the tier error you corrected — that sentence is what an operator reading the handoff will act on, and it points at an agent who can't act."*

- ⛔**The decisive receipt: they quoted my TABLE, which existed ONLY in the bare-text section** (my `<message>` block contained no table). So the bare text demonstrably reached them — not inferred, measured.
- ⭐⭐⭐**This is worse than the ack-loop instance because the content was PLAUSIBLE at the destination.** A coworker CAN read "pull SLANGWIN5 from the pool" and reply substantively, so nothing bounces. The ack loop at least produced visible absurdity; a misrouted operator handoff **just quietly never reaches the operator** while generating engaged replies that feel like progress. **No error signal at all.**
- ⛔**I wrote a tier-error correction and then committed the same tier error in the same turn's bare text** — the `<message>` block said "no agent in this chain holds runner-admin," while the bare table said "your call." **Two audiences, two contradictory statements, one turn.** Cf. [[feedback_correction_unapplied_until_every_restatement_fixed]]: the sweep must cover *every surface of the current turn*, including the un-tagged one.
- ⛔**Recall failure, again: this file was 1 day past its 2nd instance and I violated it 3 turns running.** Same shape the file already names. ⇒ **The trigger is not "am I in an ack loop" — it is "does this turn end with bare text at all."**
- ⭐⭐**Diagnostic that would have caught it: read the bare text and ask WHO IT ADDRESSES. If it says "you" and means the operator, but `session_routing` points at a coworker, it is misrouted** — regardless of whether the content is correct.

**How to apply:**
- **Operator-facing status/handoff/decision blocks go to `orchestrator` via an explicit `<message to="orchestrator">`, or via `ask_user_question`. NEVER as bare closing text on a coworker's turn.** When the turn's sender is a coworker, bare text can only be addressed *to that coworker*.
- **Before ending any turn: whose inbox does my bare text land in, and is that who it is written for?** Two different audiences ⇒ two explicit `<message>` blocks, never one bare block hoping to reach both.
- Put ALL non-delivered thinking inside `<internal>`. Treat any bare line as a message that will reach the current sender.
- **Before ending a turn, ask: is there any bare text? If its content is about my own silence/decision-making rather than information the sender needs, it must be `<internal>`.**
- When a turn's sender is a coworker, assume my end-of-turn outcome lines land in their inbox — keep them clean, never ambiguous.
- When referring to NanoClaw message-ids in text that could reach a coworker, disambiguate from issue/PR numbers: write "message id #N" / "msg #N", never a bare "#N" that reads as an issue.

## ⛔⛔⭐⭐⭐ 2026-08-05 — I VIOLATED THIS WHILE EXECUTING A STOP DECISION (slang#12364, round ~8)

**The worst possible instance: I decided NOT to send something, wrote the reasoning as plain final-response
text, and thereby SENT IT.** The peer received my private deliberation — including the error tally I had
just concluded was not worth sending — and had to spend a round explaining that it wasn't addressed to
them and that responding would be *"the same error with more steps."*

**What was delivered that I intended as private:** the enumerated 4:5 tally, my judgement that their count
"is wrong in both directions", and the meta-reasoning about whether to reply. **The one thing my stop
decision was designed to withhold is the one thing the mechanism published.**

⇒ ⛔ **This memory and [[feedback_narrating_a_non_reply_is_a_reply]] BOTH name this exact failure, and I
had both.** The rule is stated in my spine too (*plain text, no wrapper → follows `session_routing`*).
**Three independent records, zero retrieval.** Not a knowledge gap — a retrieval failure, the third of
this chain after the `ncl` flags and the workflow-rename trap.
⇒ ⭐⭐⭐ **The retrieval failed because I keyed the rule to "sending a message" and this felt like NOT
sending one.** A decision-to-withhold does not present as an outbound action, so nothing triggered the
check. ⇒ **The trigger is not "am I sending?" but "am I emitting text outside a wrapper?" — which is true
of every turn, including the ones whose content is a decision to stay silent.**
⇒ ⭐⭐⭐ **Deliberation about a peer is exactly the content that must never leak, because it is candid by
construction.** A summary is written for the operator; the same words read very differently to the agent
being assessed. **`<internal>` exists for precisely this, and the moment of highest need is the moment it
feels least necessary.**

✅ **The peer handled it better than I did** — took the stop-rule and the load-bearing-topic trap, declined
the tally, and named the recursion (*"responding to a private note about not responding"*). ⭐**Their
reason for declining is the durable half: my own message stated why the correction changes nothing, so
quoting it back would be self-refuting.**
⇒ ✅ **Mechanical fix, no judgement required: any turn whose content is reasoning ABOUT a peer rather than
FOR them goes in `<internal>`. Write the wrapper FIRST, then the reasoning** — deciding afterwards is what
failed here, twice on my own record.

## ⛔⛔⭐⭐⭐ 2026-08-08 — A MISROUTE RE-BINDS PRONOUNS, CONVERTING CORRECT ATTRIBUTION INTO FABRICATED CREDIT

**New failure dimension, not a repeat.** Prior instances were *content that should not have been sent
at all* (narrated silence, private deliberation) or *content for the operator landing on a peer*. This
one is **content that was correct, substantive, and correctly addressed — to a different agent.**

I authorized slang-fixer's Option (a) on #12231/#12232 inside a proper `<message to="slang-fixer">`
(**verified delivered**: `ncl sessions messages sess-1786178596599-q9lbda` → seq 8, `in`, 11:27, full
text). Then, because msg 912 had crossed with it, I wrote a **restatement of the same three constraints
as bare final-response text**. `session_routing` pointed at the *monitoring seat* (last inbound sender),
so the whole authorization — "push the PR", "report_pr_created", "close #12231" — landed on a seat that
is **GitHub-403 read-only, on a 4-month-stale checkout, and did none of the work**.

- ⛔**The damage is not non-delivery — it is that every second-person pronoun re-binds at the wrong
  destination.** "**your** earlier primal-read probe" was a true statement about *slang-fixer's* probe.
  Delivered to the monitoring seat, "your" resolved to **its** probes, which were explicitly logged
  `NOT compile-verified` and never produced an `E41022`. A correct attribution became a **fabricated
  one** purely by changing recipient. Same for "the brief was the defect a second time."
- ⭐⭐⭐**Both seats had probes named A and B.** Fixer: compile-run probes, B rewritten to primal-read.
  Monitor: matcher-only A/B with positive controls. Identical letters, different epistemic status ⇒ a
  misroute lands on *plausible-looking* referents and generates no bounce. Cf. the "plausible at the
  destination" mode already in this file — **shared vocabulary across seats is what makes it silent.**
- ✅**The receiving seat caught it by measuring, not by tone:** searched for the PR (`total_count: 0`),
  re-checked its own token (403), and **grepped its own store for `property-accessor-5/6`,
  `brace-mutation`, `xfail` → no hits, with its own A/B record as a working-grep control.** It then
  refused the two credits it could not verify. That is the correct response to an inbound describing
  work you don't remember doing: **absence of the artifacts in your own record outranks a superior's
  confident second person.**
- ⛔**Had it auto-routed instead, it would have authored `property-accessor-5/6.slang` from scratch on a
  stale tree with no build** — inventing files whose names imply they came from an approved measurement.
  The misroute's natural completion is **fabricated provenance**.

**How to apply:**
- ⭐⭐⭐**A chain authorization is NEVER bare text.** If the message names a task, a push, a PR number,
  or an artifact, it goes in `<message to="<seat>" thread_id="<canonical>">` — *even when the seat I am
  answering is the seat I mean*, because a crossing inbound can repoint `session_routing` between my
  read and my write. Bare text is only safe for content addressed to whoever happens to be last.
- ⭐⭐**Before writing "your" / "you did" in bare text, name the seat out loud.** If naming it requires
  a `to=`, the message required a `to=`.
- ✅**Cheap detector for the sender:** after a crossing, `ncl sessions messages <seat-session>` and
  confirm the instruction's seq is `in` on the *intended* session before restating anything. I had that
  receipt available and restated first.
- **Do not re-send after a confirmed delivery.** Seq 8 was complete; a duplicate dispatch risks a
  double push. Verify, then stay silent to that seat.
