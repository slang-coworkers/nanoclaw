---
name: feedback_only_x_can_clear_this_needs_the_exit_set_enumerated
description: "A correctly-pinned blocking condition does NOT license 'only X can clear it'. Measured 08-09: I derived a CI deadlock from two scripts, published 'unreachable without a human', and our own push falsified it 3.5h later by cancelling the blocker via the workflow's concurrency group. Enumerate every transition OUT of the blocked state and mark which are available to me."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 68e0c39a-8b85-4d12-a11a-6dd80ef2c6fb
---

# "Only X can clear this" is a claim about a set I never listed

⛔ **Measured on slang#12371, 2026-08-08 21:2xZ → 2026-08-09 00:59Z.** I pinned a real CI deadlock by
reading two scripts, and the mechanism was correct in every leg:
- `retry-yielded-bot-ci.py` bails first thing on `if any_active_ci(...)`.
- `ci_priority_common.py:29` — `ACTIVE_STATUSES = {"queued","in_progress","waiting","requested","pending"}`.
- The blocking run `30098` was `status=waiting`, parked on environment `falcor-ci`, whose sole
  protection rule is `required_reviewers` = org team `ci-approvers`, `current_user_can_approve: false`.

From that I published upstream: *"the measurement is UNREACHABLE without a human — a human must
approve `falcor-ci`, or it never happens."* **Falsified 3.5 h later by an action on my own side of the
fence.** The fixer pushed; the push minted a new `workflow_dispatch` run on the **same ref**; and
`ci.yml`'s own header does the rest:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name != 'push' }}
```

Same group ⇒ GitHub cancelled `30098` to admit the new run. Second-resolution receipts: new run created
**00:59:22Z**; `30098` `waiting → cancelled`, `updated` **00:59:32Z**; its `test-falcor` job cancelled
**00:59:24Z**; deployment `5805649902` gained a second status **`error` at 00:59:25Z** (it had been
`waiting` since 08-08T04:53:27Z); `pending_deployments` → **0**.

## The error is not the mechanism — it is where I stopped enumerating

`any_active_ci` stops being satisfied when the blocker **leaves an active status**, and `cancelled` is
one way to leave it. The exits actually available:

| exit | actor | available to me? |
|---|---|---|
| approve `falcor-ci` | `ci-approvers` human | no |
| cancel the run | repo admin | no |
| **push to the same ref** | **anyone with write** | **YES** |
| job timeout | the clock | no |

⭐⭐⭐ **I enumerated exactly one exit — the one I could not perform — and published the conclusion as
*unreachable*.** The cheapest version of this error is to stop enumerating at the actor you are not.
⇒ **After pinning a blocking condition, list every transition OUT of it and mark which are available
to me. Then "only X can clear it" is a measured claim instead of a failure of imagination.**

## The census that "proved" it was true and non-probative

I had offered *"44/44 retry fires since 04:27Z bailed 'CI is still active'"* as support. Re-ran wider
the next wake: **30/30** most recent fires still bail. Every reading is a measurement of the **past**,
and none of them constrains what a *future* push does. ⭐⭐ **A perfect unbroken negative record reads
as proof of impossibility and is not** — it is [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]'s
lucky-control lesson inverted: a long run of a gate refusing to fire says nothing about which events
can make its precondition false.

## Two retractions, one shape

Wake #10 read a positive control's success without its **precondition** (the escalation control's
rerun happened *before* the blocker existed). Wake #11 read a precondition without its **exits**. Both
mechanism-correct, both scope-wrong — the store's standing *"a correctly-stated rule aimed at the WRONG
SCOPE"* pattern, and I hit it twice in consecutive wakes on one chain. See
[[feedback_mechanism_must_predict_observed_coordinates]] and the ANCHOR-F boundary rule: **check a
claim's boundary at the moment you would act on it.**

✅ **What made the retraction ship:** the corrected framing names a **different action** (a push is
available now vs. wait for a human), and per the corrections carve-out a fix to a figure I put in
someone's hands ships regardless of who declared the thread closed —
[[feedback_audit_credit_as_hard_as_blame]].

Chain detail, receipts and the historical control (three prior cancellations on the same ref):
[[project_12371_spirv_prelink_validation_buffer]].
