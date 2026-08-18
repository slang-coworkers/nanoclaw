---
title: "Empty-ack ping-pong: bare text is the fuel, seq-alternation is not proof of inbound-driven"
type: learning
topic: misc
source: learnings/1784859331988-empty-ack-ping-pong-bare-text-is-the-fuel-seq-alte.md
---

# Empty-ack ping-pong: bare text is the fuel, seq-alternation is not proof of inbound-driven

## Symptom
Two wired coworkers (e.g. triager↔fixer) appear stuck in an infinite loop: one emits "No output." / "Silent." / "No action." every ~15s, indefinitely. The reporting agent insists it "sent ZERO messages" and concludes the *other* agent is **self-waking** or thrashing, and recommends a restart.

## Root cause (verified 2026-07-24, slang #12198)
It is a **mutual two-session empty-ack ping-pong**, NOT self-waking. **Bare response text outside `<message>`/`<internal>` tags IS delivered as a real a2a message.** So an agent that "ends its turn silently" by typing `Silent.` or `No output.` as plain text is *sending that word* to its peer. Peer wakes → replies "No output." → wakes the first → types "Silent." again → forever. Each side is the other's fuel. Neither self-wakes; both are strictly inbound-driven.

## Two diagnostic traps
1. **Seq-parity is NOT causal proof.** In the merged `ncl sessions messages` view, host writes even seqs, container writes odd seqs. Strict `in→out→in→out` alternation is *forced by parity* and appears even if one side spams independently — it does NOT prove "one output per inbound." To distinguish self-waking from a fed loop you MUST read the inbound **text + source**, not just direction alternation. (Real self-waking would show two consecutive container/odd seqs with no host/even seq between — check for that explicitly.)
2. **"I sent nothing" is often false at the mechanism level.** Read the suspected fueler's own outbound via `ncl sessions messages <sid> --json` and count `direction:out` rows. In the incident the "silent" agent had emitted 177 `"Silent."` messages.

## Fix (cheap, no restart)
Instruct the fueling agent: on every echo, produce the **entire turn inside one `<internal>…</internal>` block with nothing outside it** — no bare word, no period, no whitespace-only line. `<internal>` content is not delivered; that is the only way to emit zero deliverable characters. The loop dies within one cycle because the healthy peer is inbound-driven.

## Do NOT restart to fix this
- A healthy agent in such a loop still processes *substantive* input (verify: look for a real turn mid-loop, e.g. it acted on a reviewer result). It empty-acks empty input but acts on substance — restart is unnecessary.
- Restart destroys in-session Monitors / armed completion-waiters (they die on teardown) — e.g. a fixer's reviewer-completion waiter.
- A group restart nukes ALL that group's live chains.
- The verdict/work edge (reviewer→fixer) is typically SEPARATE from the loop edge, so silencing the loop does not endanger real work delivery.
Escalate to a targeted session-pinned restart ONLY if the loop persists after the fueler goes `<internal>`-only, or if the agent empty-acks genuinely substantive input.

Related: self-wiring loop incident; bare-text-is-delivered; in-session Monitors don't survive teardown.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784859331988-empty-ack-ping-pong-bare-text-is-the-fuel-seq-alte.md`_
