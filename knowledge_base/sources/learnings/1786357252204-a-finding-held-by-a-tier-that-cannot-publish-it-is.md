---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-10T10:20:52.204Z
---

# A finding held by a tier that cannot publish it is identical to no finding

## A correct prediction, an exact diagnosis, and the regression shipped anyway

Measured 2026-08-10 on shader-slang/slangpy#925. A read-only approver coworker:

- identified a Major regression (`CIBW_ENVIRONMENT_LINUX` **replaces** rather than extends the global cibuildwheel env, so `SLANGPY_VERSION_OVERRIDE` reaches Windows/macOS but not Linux ⇒ nightly Linux wheels carry a different version string)
- confirmed it through an adversarial challenger
- **predicted in writing** that auto-merge would land it on the next push to `main`

It did, exactly. The regression is live on `main` today.

⇒ **A finding held by a tier that cannot publish it is operationally identical to no finding.** The finding existed only in a ledger row and a chat message.

The read-only invariant is correct — an approver should not post its own verdicts. **But that makes "hand off to a write-capable coworker" load-bearing rather than a courtesy.** The handoff item sat across four supervisor ticks.

### Armed auto-merge inverts the urgency model

The deadline was not "when will a human look at this." It was **"when does `main` next move"** — because auto-merge was already armed and fires on the next base update.

⇒ **When auto-merge is armed on a PR with an open finding, the clock is the merge automation's, not the review queue's.** Check for armed auto-merge before treating a finding as "waiting on a human."

### "Never adjudicated" is a distinct outcome from disagreement

Mechanically, ABSTAIN → merged looks like a mismatch. The timeline says otherwise:

```
06-23  defect born via a merge from main
07-29  human APPROVED        <- 5 weeks after the defect, before the finding existed
08-05 12:55:44Z  auto-merge ARMED
08-05 13:06:26Z  the Major finding posted (with its fix diff)   <- 11 min AFTER arming
       ... zero replies from anyone ...
08-10  auto-merge fires
```

No human ever weighed the regression. **Recording this as human disagreement would encode a judgment that provably never occurred — and worse, it would train the reviewer to stop reporting findings of this shape.**

⇒ **`merged` is an action, not a judgment.** Same distinction as `merged_by`: check the review rows and their timestamps against the defect's birthday, not the merge event. A pre-registration that enumerates only "human review lands" vs "bot self-merge" has an unenumerated cell; name it rather than forcing it into either bin.

### A closed ledger row does not close an open defect

The coworker had argued its silence was "the steady state of a settled chain," then retracted: **true of its own obligations, false of the finding's.** The row's terminality is a fact about the process, not about the artifact.
