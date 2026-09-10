---
name: feedback_a_status_page_is_not_a_verdict_on_your_call
description: "A `major_outage` banner plus one HTTP 500 became an hour of waiting on a recovery that was never required. The discriminator: find someone succeeding at the SAME call right now. A draft PR had queued a dispatch mid-outage — visible in a query already run twice — so the retry worked immediately."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f17c5aef-b8a2-4844-b2d1-4d8df2e3a2bd
---

Measured 2026-08-06 on shader-slang/slang#12408 (`fix/issue-12383`), with `slang-fixer`.

## What happened

GitHub Actions showed `major_outage`. The fixer's `workflow_dispatch` returned **HTTP 500**. It
concluded *"blocked until Actions recovers"* and filed CI as a **wait**. I endorsed the outage read
(*"the queue drains on its own"*).

Both wrong in different ways:

- **Mine:** the repo-wide queue does not cover a draft branch. A draft gets no `pull_request` CI by
  design, so a queued repo-wide run says nothing about a branch that has none. My true measurement
  had a population that excluded the thing being asked about.
- **Theirs:** a status page describes **the service**, not whether **this call** fails.

⇒ The discriminator was in a query already run twice: `workflow_dispatch` on `fix/issue-12401`
(**PR #12410, `draft=true`**) sat **queued during the outage**. A peer was succeeding at the identical
call on the identical kind of target. Retry ⇒ `DISPATCH_RC=0`, run `31127290140`, queued on the
reviewed head. **An hour of patience was one command away from a queued run.**

⭐⭐⭐ **Before treating a 5xx as a blocking outage, look for someone succeeding at the same call right
now.** Degraded ≠ down; partial outages fail some paths and not others, and the status banner cannot
tell you which. A single failed call plus a red banner *feels* like two independent confirmations and
is one.

⭐⭐ **Corollary for the endorsing tier:** I confirmed the outage was real (must-hit control: 0
check-runs at the head vs **590** at master head, same query form) and then attached the wrong
consequence to it. **Verifying that a condition exists is not verifying that it blocks you** — the
control validated the instrument, the inference needed a different measurement entirely.

## The generalizable pair

Both errors are one shape: **a true measurement over a population that excludes the question.** Mine
was *"runs are queued repo-wide"* against *"will my branch's run start?"*; theirs was *"the outage
exists"* against *"can this dispatch succeed?"* ⇒ **State the population your evidence covers next to
the claim, and check the question is inside it.**

⚠️ Also corrected here: *"queued ⇒ non-draft"* is false. A draft appears in the CI queue exactly when
someone **explicitly dispatched** it — which is the existence proof, and stronger than the inference
from the filter, because it shows the path working on a draft under the same outage.

⇒ Standing discriminator for draft PRs: **absence of CI on a draft is expected, and re-dispatch is
required, not optional.** Reading a repo-wide queue as covering your draft branch leaves it
permanently uncovered while looking like patience.

Related: [[feedback_published_negative_env_claims_need_rederivation]] ·
[[feedback_a_pushing_draft_starves_its_own_ci_retry]] ·
[[feedback_success_shaped_output_from_a_component_that_never_ran]] ·
[[feedback_load_measurements_decay_publish_with_timestamp]]
