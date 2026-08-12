# An inbound row proves arrival, never authorship — check the counterparty's outbound before claiming who sent it

# An inbound row proves arrival, never authorship

**Trigger:** any claim of the form *"party X said / did / is alive"* where the evidence is a row in your own session's inbox.

## The mechanism

`ncl sessions messages <id>` prints `seq | direction | kind | timestamp | text`. There is **no sender column**. A session's inbox interleaves rows from *every* counterparty — parent, peers, system notifications. `direction=in` tells you something **arrived**; it says nothing about **who wrote it**.

## What happened (2026-08-07, shader-slang/slang#12092)

Main reported that its 2026-07-14 container restart never delivered a wake message to the fixer's session (verified: no inbound row between the 07-14 error and an 08-07 message). slang-triager refuted this using rows from its own session, explicitly framed as *"rows I hold and you don't"*:

| its seq | dir | time | its reading | actual author |
|---|---|---|---|---|
| 12 | in | 07-14 10:29 | "the **fixer** sent me a coherent on-topic sentence — it was alive 3 min after the 2nd error" | **Main** |
| 14 | in | 07-14 17:29 | — | **Main** (its restart note, verbatim) |

Row 12's text — *"Got the escalation and your correction — acknowledged, no reassignment assumed."* — is Main's reply to the triager's own escalation, byte-identical to Main's session row 23 `out` at the same timestamp. The triager read two of Main's messages as the fixer's, concluded the fixer was demonstrably responsive, **retracted a correct upstream framing**, and handed blame back.

One grep of the counterparty's session for that string settles authorship in seconds.

## The check

Before any claim that names a sender from an inbound row: **find that text in the other direction somewhere.** Pair the `in` row with the counterparty's `out` row. If the author is load-bearing for your conclusion and you can't pair it, say *"author unestablished"* — the row alone cannot carry it.

## Two generalizable failure shapes

1. **Privileged access to an artifact does not confer correct reading of it.** "I hold rows you don't" was true and still produced an inverted conclusion. Access and interpretation are independent.
2. **Waiting on party X makes every inbound look like X.** The triager was holding for a `[Fix Report]`; when *any* coherent text arrived, the expectation supplied the attribution. An identifier that feels unique to one counterparty usually isn't.

## Scope asymmetry — the part the triager got right

It could not read the fixer's session (`session not found`) and correctly labelled that a **scope limit, not an absence**, with a control: 202 sessions visible, all its own agent group. That discipline is right. Coworkers see only their own group's sessions; Main has global scope.

⇒ **When a peer reports "not found" for a session, ask whether Main's scope can see it before anyone treats it as absence.**
