---
title: "[approver/infra-abstain] The 'check_suite success is unproven' asymmetry is an artifact — GitHub sends ONE completed action with conclusion as a payload field, so 19 observed failure deliveries prove the trigger fires; the real blocker is the no-TTL park, which stands on its own"
type: learning
topic: review-approval
source: learnings/1785944217481-approver-infra-abstain-the-check-suite-success-is-.md
---

# [approver/infra-abstain] The "check_suite success is unproven" asymmetry is an artifact — GitHub sends ONE completed action with conclusion as a payload field, so 19 observed failure deliveries prove the trigger fires; the real blocker is the no-TTL park, which stands on its own

# [approver/infra-abstain] Two events or one field? The asymmetry that justified a hold was a logging artifact

## Symptom

My orchestrator recommended **not arming `APPROVER_CI_GATE`** on an asymmetry
argument:

- `check_suite` **failure** deliveries are proven — 19 `ci_failed` routings in host
  logs, one quoted at a real head (`shader-slang/slang#12123`, head `7a3a5bee821a`);
- `check_suite` **success** deliveries are unobserved — grep for `check_suite
  success`, `no PR parked at this head`, `not required suite`, `releaseParked` → **0
  hits each** (positive control `ci_failed` = 19);
- ⇒ "the failure path is proven and the success path is assumed, and the assumed one
  is load-bearing for release" ⇒ wedge risk on every reviewable PR.

**The asymmetry does not exist.** Per GitHub's webhook reference, the `check_suite`
event has exactly three actions — `completed`, `requested`, `rerequested` — and:

> "All check runs in a check suite have completed, and a conclusion is available."

There is **no success action and no failure action.** `conclusion` (`success` /
`failure`) is a **field in the payload** of the same `completed` delivery. So the 19
observed `ci_failed` routings *are* 19 observed `action=completed` deliveries — they
prove the trigger fires. A differing field value does not make it a different event.

The 0 hits measure the **logging**, not the **delivery**: while the gate is off there
is no code path that emits a "success but nothing parked" line, so its absence is
guaranteed by construction and carries zero bits. That's the false-zero /
negative-evidence pattern again — a grep returning nothing because the emitter
doesn't exist yet.

## Root cause

Two failure modes compounded, and both are already in my store under other names:

1. **A field mistaken for an event type.** The narrower an event's action set, the
   more likely the distinction you care about lives in the payload. Ask *is this a
   different event, or the same event with a different field?* before treating two
   cases as independently-verifiable paths.
2. **Negative evidence from an unarmed code path.** "We have never seen X logged"
   where X is only logged when a disabled feature is on is **unfalsifiable**, not
   weak. It could not have come out any other way — my own standing probe
   ("negative safety evidence needs a positive control") applies verbatim, and the
   orchestrator even supplied a positive control (`ci_failed`=19) for the *wrong*
   proposition: it controls for "logs exist", not for "this line would appear if the
   delivery happened."

Also over-broad on my side, and I caused this branch: I quoted
`pr-checks-complete.yml`'s header — *"GitHub deliberately does NOT deliver
check_suite/check_run events for suites created by GitHub Actions (recursion
prevention)"* — as general fact. It is about **`on: check_suite` as a workflow
trigger inside Actions**, not about webhook delivery to a third-party App. Delivery
to an App is proven by those 19 routings. A comment's scope is the scope its author
was working in.

## The finding that survives — and it is the stronger one

Independent of the asymmetry, the orchestrator measured that **a park has no exit**:

- `host-sweep.ts` — **0** mentions of `parked` across 712 lines (it does handle
  `processing_ack`, `recurrence`, `stale`);
- `pending-reviewable/store.ts` exports only `parkReviewable` / `findParkedByHead` /
  `deleteParked` — **no TTL, no expiry, no list**.

So *any* missed release — for any reason, not just a missing event — is a
**permanent, invisible park** whose only exit is manual DB deletion. That is a real
blocker and it needs no claim about event delivery at all. **It is also the argument
that should have been made first**, because it holds whether or not the trigger
fires.

## How to catch it

- Before treating two cases as separate verifiable paths, read the event's **action
  enum**: `WebFetch` the webhook reference, or check whether your discriminator is a
  field. One delivery + a field ⇒ observing either value proves the trigger.
- For any "we've never observed X" claim, ask **could X have been observed given the
  current config?** If the emitter is behind the flag you're deciding about, the
  observation is impossible and the claim is empty.
- Separate *"the mechanism is unproven"* from *"the mechanism has no safety net."*
  The second survives being wrong about the first.

## Fix

Recommendation to the operator, corrected: **the trigger is proven; the missing piece
is park recovery.** Don't gate arming on watching for a success delivery (which the
19 completed deliveries already establish) — gate it on **a TTL/expiry + a
list/observability path for parked reviewables**, so a missed release degrades to a
late wake instead of a silent permanent wedge. `CI_GATE_REQUIRED_CHECK_RUN` on
`shader-slang/slang=check-ci` remains the precise lever; slangpy still needs a
`needs: [build]` + `if: always()` roll-up first.

**Method, durable half:** a hold recommendation deserves the same audit as an arm
recommendation. This one had a true premise (no park recovery) and a false one (event
delivery unproven), and the false one was doing the rhetorical work — the asymmetry
framing is what made it feel decisive. *A correct conclusion reached through a wrong
mechanism will be defended with the wrong evidence when it's challenged.*

Siblings: "a retraction is not self-verifying"; the false-zero positive-control rule;
`CI_GATE_REQUIRED_SUITE` cannot discriminate on Actions-only repos.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785944217481-approver-infra-abstain-the-check-suite-success-is-.md`_
