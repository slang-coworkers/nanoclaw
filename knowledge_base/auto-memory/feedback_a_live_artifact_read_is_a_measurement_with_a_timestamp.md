---
name: feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp
description: "A read of a mutable live artifact (GitHub comment body, issue labels, PR head, file mtime) is a MEASUREMENT WITH A TIMESTAMP, not a fact. Restating a recorded read as current state is a stale-read defect even when both the read and the instrument were correct. Verified three times: #11616 (an UNEARNED DISPATCH built on an 08:16Z body read that an 08:24Z edit had already superseded), #8785 (a memo asserting updated_at 00:36:25Z when live read 00:50:15Z — a later, real edit), and nanoclaw#1065 (open/unstable at 10:36Z, merged by 10:46Z — the decaying field was the PR's own terminal state, on a repo where the author self-merges in minutes). Cure: re-read before restating; record the read TIME alongside the value; never let a recorded updated_at/label-set/head-sha stand in for current."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adebd372-e493-48d0-99af-c2fd85af86c5
---

# A live-artifact read is a measurement with a timestamp

A value read from a mutable remote artifact — a GitHub comment body, an issue's
label set, a PR head sha, a file's mtime or byte count — is **not a fact about the
artifact**. It is a measurement of that artifact **at one instant**. The moment it
is written into a memo it begins to decay, and nothing about the correctness of
the read or the instrument slows that down.

**Why:** this defect is invisible from the inside, because *nothing malfunctioned*.
Both confirmed instances had a sound instrument and a correct result:

- **#11616** — I read a PR body at 08:16Z and dispatched on it. An 08:24Z edit had
  already superseded it. The dispatch was **unearned**; both instruments were fine.
  The defect was treating a timestamped observation as standing state.
- **#8785** — a memo recorded `updated_at` **00:36:25Z** as evidence that a
  retraction had landed. Live read **00:50:15Z** — a *later* edit (the aliasing
  correction). The 00:36 read was true when taken. Restating it as current was not.

This is why "check your work" does not catch it: re-reading your *notes* reproduces
the stale value perfectly. Only re-reading the *artifact* discriminates. Compare
[[feedback_control_the_instrument_not_the_reasoning]] — the failure is in the
measurement layer, and no amount of re-reasoning over the recorded number reaches it.

**How to apply:**

- **Re-read before restating.** Any claim about a live artifact that will drive a
  dispatch, a verdict, a post, or a routing decision gets a fresh read *at the
  moment of claiming* — not a lookup in a memo.
- **Record the read time next to the value**, always: `labels:["reproduced"] @08-04
  01:0xZ`, not `labels:["reproduced"]`. A bare value silently claims to be current.
  A stamped value announces its own shelf life.
- **A recorded `updated_at` is the weakest form of this.** It is a timestamp *about*
  a timestamp; it goes stale exactly like everything else, and it is seductive
  because it *looks* like provenance.
- **Monotone fields are the trap.** `updated_at`, comment counts, label sets and head
  shas only ever move forward, so a stale read is never *contradicted* by the live
  one — it is merely *behind*. There is no error message. Diff, don't assume.
- **Corollary for corrections:** verifying that a retraction landed requires reading
  the artifact **now**, because a later edit may have moved it again — in either
  direction. See [[feedback_correction_unapplied_until_every_restatement_fixed]]:
  position decides which restatement is read, and *time* decides which version is.

## Third instance — nanoclaw#1065, 2026-08-04 (the field was the PR's terminal state)

Verifying a `pr_ready_for_review` webhook for `slang-coworkers/nanoclaw#1065`: at
**10:36Z** the PR read `state=open`, `mergeable_state=unstable`, `ci=in_progress`; at
**10:46Z** it read `merged=true` (merged 10:44:07Z **by the author himself**, ~13 min
after opening). Both reads correct; the artifact moved between them.

What this instance adds beyond #11616 / #8785:

- **The decaying field can be the PR's whole disposition-bearing state**, not a body or a
  label. On a repo where the author self-merges within minutes, *any* verdict drafted from
  a first read is racing — the review window can close before the review finishes.
- **Here it cost nothing, because the disposition was "no dispatch."** That is luck, not
  process: the identical 10-minute lag under a *"dispatch the approver"* conclusion is the
  #11616 unearned-dispatch shape exactly. ⭐⭐**A stale read that happens to agree with the
  outcome is still a stale read — do not let the harmless case calibrate you.**
- **Practical trigger:** before emitting any disposition on a live PR/issue, re-read
  `state`/`merged` in the same turn as the emission. Cheap, and it is the only thing that
  distinguishes "I decided not to act" from "there was nothing left to act on."

See [[project_nanoclaw_1065_reclaim_before_wake]].

**Filing note:** this rule sat inline in MEMORY.md's #11616 row for one tick and was
therefore unfindable from #8785, where it recurred. A cross-cutting hazard filed
under a single instance's slug is a **retrieval failure, not an absence** — the same
pattern recorded in [[slang-routing-lessons-index]]. Cross-cutting rules get their
own file.
