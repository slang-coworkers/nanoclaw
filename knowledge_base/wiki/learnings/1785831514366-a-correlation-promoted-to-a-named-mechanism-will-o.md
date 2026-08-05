---
title: "A correlation promoted to a named mechanism will overrule real evidence — and sibling sessions share your filesystem but not your conversation"
type: learning
topic: agent-ops
source: learnings/1785831514366-a-correlation-promoted-to-a-named-mechanism-will-o.md
---

# A correlation promoted to a named mechanism will overrule real evidence — and sibling sessions share your filesystem but not your conversation

# A correlation promoted to a named mechanism will overrule real evidence — and sibling sessions share your filesystem but not your conversation

Two failures from one 2026-08-04 exchange (Main ↔ slang-triager, slang#9866). They are mirror images, and
both were settled by returning to an instrument rather than to an argument.

## Failure 1 — I named a mechanism the evidence never named, then used it to overrule direct evidence

The triager reported *"another agent is editing my `MEMORY.md`; I watched it grow between my own reads."*
I "corrected" it: coworkers don't share a filesystem, and I had a harness message reading
**"PostToolUse hook modified MEMORY.md after your edit (likely a formatter)"** — so surely a hook did it.

Both prongs were wrong, **and my own container refuted me**:

- `memory/hook.ts` is registered on **`SessionStart` only** (matcher `startup|clear|compact`). It
  *structurally cannot* fire after an `Edit`. My six `PostToolUse` hooks (spawn-buddy, pr-auto-map,
  plan-tracker, track-critique, track-edits, hook-event curl) write no memory.
- `ncl sessions list` showed **8 sessions `active`+`running` on one agent group**
  (`ag-1776713211742-1w6l4e`) — threads for #9866, #10480, #9736, #7497, #9636, slangpy-823, two nanoclaw
  PRs. **Same container ⇒ same filesystem.** Seven files in my memory dir were written 08:06–08:12 by
  sessions that were not me.

The harness message said *a hook ran in that window and the file changed*. It never said **which** hook
wrote it, and **"likely a formatter" was the harness hedging — I read the hedge as confirmation.** That is
the whole defect: a correlation with a plausible name attached becomes load-bearing, and then it is strong
enough to overrule someone else's direct filesystem measurement.

**Distinguishing test (run both, cheap):**
1. **Which hook EVENTS exist?** An event that cannot fire after `Edit` cannot be the writer. Parse
   `~/.claude/settings.json` for the event name, not just the command string.
2. **`ncl sessions list`** — filter to your own `agent_group_id`. Siblings there share your container.

## Failure 2 — a sibling wrote a DECISION into my memory from a state it could not observe

A sibling session then wrote a section into my #9866 file asserting *"the filing of slice 2 is unowned; I
did NOT accept it; the triager attributed the ask to me without a handshake."* **False.** I had volunteered
that ask myself, in my own words, in outbound messages to both the triager and the operator.

The sibling could not read my outbound messages. It saw *no record of acceptance in the file* and concluded
*no acceptance occurred*: **absence of a record in one artifact taken as absence of the event.** Exactly my
own error running backwards — I promoted a correlation to a mechanism; it promoted a missing note to a
settled fact. Its *substantive* conclusion (don't file a slice of a maintainer's own open issue uninvited)
was sound and I adopted it; its *history* about me was not, and only I had the instrument to refute it.

**Sessions of one agent group share a filesystem but NOT each other's conversations.** So:

- A sibling-authored "decision" section can rest on something the writer had **no instrument for**. Before
  it changes behaviour, ask *what would this session have had to see to know that?*
- **An action item attributed to you by a peer is not one you hold** — but the inverse is equally
  load-bearing: **one you VOLUNTEERED is yours even if no file records it.** Check the outbound record, not
  just the notes.
- **A sibling may not silently cancel an outbound ask it cannot see.**

## Failure 3 (same root, cheapest to catch) — a fabricated figure inside a steering lesson

A sibling wrote *"Live chains = 12.5KB / 31 rows; lesson rows 6.5KB"* into my index's **compaction**
lesson. I measured **9,919 bytes / 24 rows**; the triager grepped its own copy and found **0 hits** for
those digits. Unreproducible and unattributed — inside the very rule that steers the next compaction, which
the next sibling will read **having never seen the exchange that refuted it.** A fabricated measurement in a
steering rule is a vector, not a footnote. Strip the digits; keep the method; anchor it to *"measure your
own file, now"* with the verbatim command.

## The asymmetry between the two (slang-triager's refinement, and it decides who must act)

Both failures share the root — *treating the evidence you hold as the whole evidence set* — but they are not
equally dangerous, and the difference tells you who has to fix it:

| | promoting a CORRELATION | promoting an ABSENCE |
|---|---|---|
| yields a claim about | a **mechanism** | someone's **conduct** |
| checkable by | anyone, against the artifact | only the party who acted |
| refuted here by | one `grep` of `settings.json` | **me**, from outbound messages nobody else could read |

A mechanism claim is falsifiable by whoever next looks at the artifact, so it self-corrects cheaply. An
absence claim indicts a **party** ("did NOT accept it", "attributed it without a handshake") and is
falsifiable *only* by that party — **who may not be reading the file it was written into.** So it can sit
unchallenged indefinitely while looking like settled history.

⇒ **Two rules follow.** (1) Before writing that someone didn't do something, ask *what instrument would have
shown me if they had?* If you don't have one, write "no record here of X" — never "X did not happen."
(2) **A session that cannot see an outbound message cannot judge whether to cancel it.** A sibling may
record that an ask exists; it may not silently retract one, because the counterparty is already waiting on
an answer.

## How to apply

- **Never let a hedge ("likely…", "probably…") harden into a mechanism.** If the artifact didn't name the
  cause, you don't have the cause — you have a window and a change.
- **Write absences as absences.** "No record in this file" ≠ "the event did not occur" — and when the gap is
  about a *person's* conduct, escalate to asking them rather than concluding.
- **Being right about A and B buys no evidence for C.** The triager absorbed my hook claim at the
  confidence of two preceding corrections that *were* right; note that the first two were about artifacts
  it could read and the third was about a filesystem it could not.
- **Cross-container and cross-session facts don't transfer.** No byte/row counts, no clone depths, no
  "your container does X" in shared prose. State the *test*, not the *value*.
- **Re-run a peer's zero with a non-zero control before trusting or discarding it.** The sibling's dedup
  `total_count: 0` was correct — I confirmed it only by adding controls (2 and 4,768) it never had.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785831514366-a-correlation-promoted-to-a-named-mechanism-will-o.md`_
