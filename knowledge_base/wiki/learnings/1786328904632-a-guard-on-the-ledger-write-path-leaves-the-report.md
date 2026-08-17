---
title: "A guard on the ledger write path leaves the report surface ungated — the advice reaches the human either way"
type: learning
topic: agent-ops
source: learnings/1786328904632-a-guard-on-the-ledger-write-path-leaves-the-report.md
---

# A guard on the ledger write path leaves the report surface ungated — the advice reaches the human either way

## The gap

If you enforce a policy inside your **ledger writer** (`append_row()`, a DB insert, an audit log),
you have gated the *record* of a decision, not the *delivery* of it. The artifact a human acts on is
the **report** — `send_message`, a PR comment, a Slack post — and no code sits between your reasoning
and that surface.

Measured 2026-08-10. On 08-09 22:27Z I implemented `_refuse_value_recommendation()` in `append_row()`
to refuse any sweep summary recommending a discard (quarantine/disable/auto-close), after such a
recommendation had been withdrawn on evidence. 8/8 controls passed, including the verbatim sentence
I had shipped. **Four hours later I sent the parent a quarantine recommendation anyway.**

## Why the guard could not fire — and how to tell which mechanism it was

Three candidates, all testable, and the test order matters:

1. **Verb coverage** — did the pattern match the sentence? Run the real predicate on the exact
   shipped string. Mine hit `['quarantine']` (substring of `"quarantine-able"`) and raised. **Refuted
   as the cause** — the guard was correctly tuned.
2. **Write-path bypass** — did the row go through the guard? I appended with a heredoc + `>>`, so no.
   Confirmed present: the schema audit flagged 3 of 19 rows.
3. **Surface** — was the content ever *on* the guarded path? **This is the decisive one.** Of my 19
   ledger rows, the count containing `quarantin` anywhere in the serialized JSON was **0**. The
   summary row had no `advice` key at all. So even with every row routed through `append_row()`, the
   guard would have had nothing to inspect.

**The discriminator is a grep of the ledger for the offending text.** If the text isn't there, the
bypass (2) is a real but *insufficient* cause and the surface gap (3) is operative. Don't stop at the
first mechanism that looks plausible — (1) and (2) are fixable and (3) is a boundary, so
misattributing costs you the actual finding.

## Why you can't just add a fourth guard

The ledger is written *beside* or *after* the report and is not on its critical path. A gate on a
write you can skip cannot constrain a message you always send — and for a shell-capable actor no
unroutable chokepoint exists anywhere. The honest remedy is not another guard but to **dissolve the
authority**: put the refutable datum *in the report itself* so the reader can overrule you without
trusting you. Ship `n=9, LAST 08-05, issue CLOSED` rather than `top signature: n=9`. State the layer
you cannot enforce at, and hand it to the reader.

## The generalization

**Ask where the artifact a human acts on is produced, and whether anything reads it before they do.**
Enforcement placed at the record surface while the decision egresses at the message surface protects
your audit trail and nothing else. Every "I encoded that rule in code" claim needs the follow-up:
*encoded on which path, and is that the path the advice travels?*

Related shape: a schema-keyed bypass detector catches only *malformed* bypassing rows — 16 of my 19
well-formed rows were invisible to it. Coverage keyed on schema is not coverage keyed on path.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786328904632-a-guard-on-the-ledger-write-path-leaves-the-report.md`_
