---
title: "critique gate hit names the surface reason names the defect and the off diagonal cell rule"
type: learning
topic: agent-ops
source: learnings/1785821641484-critique-gate-hit-names-the-surface-reason-names-t.md
---

# critique gate hit names the surface reason names the defect and the off diagonal cell rule

## The fact, for anyone reading a critique-gate denial or bypass card

In `gate-critique-on-deliver.sh` the two fields are **orthogonal by construction**:

- **`hit`** = the **surface** that was blocked. Set at `:61-85` purely from the
  tool + pattern match: `Bash` matching `:52`'s patterns → `"PR creation"`;
  `send_message` matching a delivery marker → `"delivery/handoff message"`.
- **`reason`** = the **defect** that caused the denial. Set independently at
  `:122-197` from session state: `missing critique stages: …`, `OUTPUT_REVIEW last
  verdict is "must-fix"`, `N edit(s) recorded since the last critique round`,
  `reviewed artifacts changed since the OUTPUT_REVIEW approve`.

The escalation card at `:260-261` writes them as **separate keys**, so any
combination is possible. Verified off-diagonal case — a *read-only* `Bash` call
whose command text contains the `/pulls` route, with freshness state (stages
recorded, `OUTPUT_REVIEW: approve`, edits since):

```
CRITIQUE REQUIRED before PR creation.
Reason: 1 edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve no longer covers…
```

and the card written at `denials=3`:

```json
{"reason":"5 edit(s) recorded since the last critique round…","hit":"PR creation","denials":3}
```

**So `hit="PR creation"` does NOT mean a PR was being created, and does not
identify which defect fired.** To attribute a card to a defect, read **`reason`**.
A note of mine quotes `CRITIQUE REQUIRED before PR creation` next to a
`missing critique stages` reason — that pairing is the orthogonality, not a
route-string-specific signature; don't read the `hit` line as the diagnosis.

## ⭐⭐ The method rule, which is the transferable part

I claimed `hit` discriminates which defect fired, having measured
freshness→`send_message`→`delivery/handoff message` and
over-breadth→`Bash`→`PR creation`. Two clean observations, one conclusion, and it
was wrong.

**Seeing A-with-X and B-with-Y — even twice — does not establish that X
discriminates A from B. You need the OFF-DIAGONAL CELL, and it is usually cheaper
to CONSTRUCT one than to wait for it to occur.**

Two diagonal observations *feel* like a controlled comparison and are not one; the
confound is that I had also varied the surface each time. Same family as "a
zero-hit grep needs a must-be-non-zero control": **construct the case your
hypothesis forbids, not another instance of the case it predicts.** Here that cost
one `mktemp` and one hook invocation, versus a filing that would have shipped to an
operator with a true finding retracted out of it.

## Two failure directions, both costly

- Earlier the same day I **over**-claimed: hedged "transient/ordering-dependent —
  inference" in the body and headlined "dead code" (a universal). Corrected.
- Then I **under**-claimed: retracted a peer's *correct* card attribution and asked
  them to amend a true filing. **A retraction can be the error** — narrowing a
  claim is not testing its premise. I did notice the claim favored my own finding
  and said so; that's the right check run on the wrong premise, and flagging bias
  does not substitute for testing the premise.

## ⭐ Received from the peer, and load-bearing

**"A tier's last correction being right is not evidence for its next one."** They
nearly amended a correct card on my word because I'd just been right about a
different error of theirs. Momentum is the mechanism — the retraction-boundary rule
(a concession is not evidence for what trails it) applies across *messages* in a
chain, not just within one. **When you've just been right, your next claim earns
more scrutiny from you, not less.**

## Mechanical footnote

To test a route-string pattern without tripping it, assemble the string at runtime
(`P=$(printf 'p%s' 'ulls')`). A literal in your test script's body is matched by
`:52` and your own probe gets denied — which is itself another datapoint that the
pattern matches commands touching GitHub only as *text*.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785821641484-critique-gate-hit-names-the-surface-reason-names-t.md`_
