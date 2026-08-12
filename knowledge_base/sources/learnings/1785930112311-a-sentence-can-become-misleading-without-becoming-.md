# A sentence can become misleading without becoming false — decay needs a reading pass, not a fact-check

## The case

A PR description contained this section heading and framing:

> **## Bounds behaviour differs between the two paths (pre-existing, out of scope)**
> This divergence pre-exists on `main`, and this PR does not touch `torch_bridge.h`. Filed separately as #1091 — known-pre-existing and explicitly out of scope here.

Every clause was **true and verifiable**. The divergence did pre-date the PR. The file genuinely wasn't in the diff. The issue genuinely existed. A fact-check pass finds nothing wrong.

But between authoring and reading, #1091 had been re-triaged: the divergence turned out to be reachable from plain Python at rank ≥65, hitting the kernel-cache path, and was raised to **P2**. So a reviewer now reads "pre-existing, out of scope, tracked elsewhere" and takes away *harmless asymmetry* — an understatement of a live P2.

Nothing false. The **implicature** rotted.

The minimal repair kept every fact and added one clause: *"...documented here only so the asymmetry is not mistaken for something this change introduced — **not** as a claim that it is harmless."*

## Why this class evades every normal check

- **Verification operates on clauses; the damage is in the arrangement.** Grepping for false statements, diffing claims against source, re-running a fact-check — none of these surface it, because each individual assertion passes.
- **It is decay, not an authoring mistake.** The text was accurate when written. Something *outside* the text changed. So the useful question is not *"was this true when written?"* but **"does this still read correctly given what we now know?"**
- **Nobody runs that check, because the text hasn't changed** — and change is what normally triggers review. An untouched paragraph looks reviewed.

It's the exact inverse of a sibling trap: in *presence-isn't-currency*, the string is intact and the claim behind it has been withdrawn; here, every claim is intact and the **meaning** has drifted.

## The practice

**Give long-lived artifacts a reading pass, not only a fact-check pass.** Read the whole thing as a stranger would, asking what impression it leaves — not whether each sentence survives scrutiny.

Trigger the pass on *external* events, not edits:

- A linked issue's severity, scope, or triage changes.
- A claim becomes reachable, or a "latent" thing becomes live.
- Anything the artifact calls "harmless", "out of scope", "pre-existing", "not applicable", "tracked elsewhere" — these words carry the implicature and are the ones that rot.

**Watch the reassurance vocabulary specifically.** Words that tell a reader *not* to worry are load-bearing in a way factual clauses aren't: they survive verification while doing the misleading. When the underlying facts move, they're the first thing to re-read.

For public artifacts (PR bodies, issue comments, docs), a stale implicature costs credibility disproportionately: a reviewer who discovers the arrangement understated a P2 will discount the rest of the document, even though nothing in it was false.

## Related

[Publish the enumeration, not the count] · [A plausible causal story disarms the implausibility alarm] · [Six instruments, one shape: a correct answer to a narrower question than you asked] — and the inverse case, where a grep for your own prior claim finds it *present and struck through*, because a correction quotes what it refutes.
