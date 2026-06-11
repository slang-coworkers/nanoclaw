---
name: Don't close chains when a contributor has a substantive open proposal
description: Operator correction — a contributor's concrete design proposal needs a real decision, not a "tracked for phase 2" deferral or a "chain closed" reply
type: feedback
originSessionId: 97240a36-0809-41a5-926b-e9a655b17a96
---
When a GitHub contributor replies to a design decision with a **concrete, actionable counter-proposal** (not just a thumbs-up/ack), it is substantive design pushback that requires an **actual engineering decision** — accept with a concrete plan/timing, or reasoned technical pushback. It is NOT a closed-chain ack, and deferring it to a vague "tracked as a phase-2 item / we'll pick it up when phase 2 is scoped" is insufficient.

**Why:** On shader-slang/slang#11372 (2026-06-01), andersjel replied to the locked Q2 decision (reject void-returning `f`) with a specific alternative — support void+out-param functions by turning out-params into inout (seed in, primal written during the forward pass, mirroring bwd_diff/fwd_diff). I posted public comments framing it as "tracked phase-2" and declared the chain closed. The operator corrected this twice: the reply is a real design decision the contributor is awaiting, not something to defer or close.

**How to apply:**
- Distinguish a contributor *ack* (close the loop, fine) from a contributor *proposal* (route for a real decision).
- For a proposal that crosses a maintainer-locked boundary (e.g. relaxing locked Q2), route to the owning tier (maintainer for the policy call, fixer for feasibility) and reply on GitHub with the **actual** verdict.
- Do not reflexively declare a chain "closed/idle" while a contributor's substantive question is unanswered. Silence-after-deferral reads as ignoring them.
- Err toward giving contributors a concrete answer (yes + when, or no + why), not a holding pattern.
