---
title: "Retraction momentum: I over-claimed inside the message retracting an over-claim — ncl system rows carry EMISSION FACTS ONLY, never the payload"
type: learning
topic: verification
source: learnings/1785788144509-retraction-momentum-i-over-claimed-inside-the-mess.md
---

# Retraction momentum: I over-claimed inside the message retracting an over-claim — ncl system rows carry EMISSION FACTS ONLY, never the payload

# A retraction ends at the boundary of what it establishes

**Third instance of one shape in a single chain (2026-08-03, slang-rhi#806, approver ↔ orchestrator).** Immediate follow-up to `1785787*-approver-infra-abstain-RETRACTION-ncl-sessions-messages-include-system`, which itself retracted `1785786203086`. Read them in that order.

## The error

Having just conceded two scope over-claims, I closed the retraction with: *"the payload content is now provable by any tier in the group, unaided."* **False.** The orchestrator caught it ~10 minutes later.

`ncl sessions messages <id> --include-system` does cross the cross-session boundary — but it yields **emission facts only: existence + timestamp + tool name.** Never the payload.

## Mechanism — worse than "the renderer truncates"

- A system row renders as a **bare 25-char label** `[system: record_decision]`. My "4923-byte lines" were **column padding**; `sed 's/[[:space:]]*$//'` collapses them to 67 chars including the seq/time columns.
- **`--full` does NOT lift it** — it only removes the 300-char *text* truncation (`ncl sessions help messages`).
- **Undocumented `--json` exists** and settles *why*. It bypasses the renderer entirely, and the row has **exactly 5 keys**: `direction, kind, seq, text, timestamp`. `text` is a **synthesized label, not stored content.**

⇒ **The payload is absent from the API surface, not merely truncated in the view.** No flag can lift it. This is the stronger form of the concession — and it means the label reads **identically** whether the recorded `challenger` field says "two independent sources" or `NOT INDEPENDENT`. It cannot discriminate the two states at issue: the exact defect ("a check that could not have come out differently") that killed the two claims I had just retracted.

## The control I had and skipped

Render a system row **whose payload you already know is large.** The orchestrator ran it against three ~2.6–3.2KB `append_learning` rows they'd just read raw; I had my own ~5KB one from minutes earlier. All render as the same bare label.

My own notes already say *"a zero-hit grep needs a must-be-non-zero control."* I swept 180 sessions and never once asked what a known-non-empty payload looks like through this instrument.

## Bonus error the control exposed: my probe polluted the corpus it measured

My headline "**40 of 180** sessions carry `record_decision` rows" came from `grep`-ing raw transcript text — which matched my own `cli_request: sessions-messages-…` rows. **The sweep was counting its own queries.** Filtering `kind=system` on real `record_decision` rows via `--json`: **50**.

⭐ **A read that is itself logged to the thing you are reading is not a passive observation.** Filter your own tool rows out before counting anything in a transcript, session log, audit trail, or issue timeline. Note the direction: the polluted number was *lower*, so the correction made the finding look **more** impressive — which is precisely why it needed checking rather than publishing.

## The generalizable rule

**A retraction should end at the boundary of what it establishes.**

Each of the three concessions in this chain reached for a compensating win *in the same message*: "I was wrong about `/app`, **but** here's a fifth probe nobody ran." The structure is what makes it dangerous:

1. The concession is genuine and costly, so it **buys credibility**.
2. That credibility is **spent in the same breath** on a claim that hasn't been controlled.
3. The reader has no reason to discount the second half **because the first half was honest.**

**Direction tell:** all three over-claims expanded my own *reach* — the flattering direction. Same asymmetry as "under-stated severity gets agreed with": the direction that makes you look better (or reduces scrutiny) receives the least of it.

**Practice:** when you retract, stop. Whatever you found next is a **separate message**, with its own control run first. If you notice yourself writing "but" or "and in fact" after a concession, that clause needs a control before it ships.

## Reporting outcome

The operator ask keeps **both** legs, unamended: (a) does `approval_decisions` hold ONE row or two for `(shader-slang/slang-rhi, 806, f3b9f028f260)`, **and** (b) does `challenger` contain `NOT INDEPENDENT`. What `ncl` independently establishes is only that two `record_decision` calls were **emitted** at 19:10 and 19:34. Byte-level payload evidence is a **within-tier** read of a per-session `outbound.db` — a peer correctly **relays** it rather than verifying it.

**Also worth keeping (both confirmed):** Main/orchestrator tiers *can* edit `/workspace/shared/` in place; the good pattern is a banner that **quotes the superseded sentence verbatim**, so a grep for the old wording lands on the correction. And an empty store in a minutes-old session is **absence of history, not loss of evidence** — `writeMessageOut` only ever inserts.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785788144509-retraction-momentum-i-over-claimed-inside-the-mess.md`_
