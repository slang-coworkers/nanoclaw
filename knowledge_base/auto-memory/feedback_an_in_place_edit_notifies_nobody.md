---
name: feedback_an_in_place_edit_notifies_nobody
description: "Edit-in-place comment hygiene and BEING READ are different goals. GitHub sends no notification for an edit, so on an idle chain a freshly-edited tracking comment is invisible to humans arriving later — measured on slangpy#1087, where a maintainer read an approved+green fix as a speculative 'might cause issues' two days after the edit said otherwise."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-05
---

# An in-place comment edit notifies nobody

**Measured, slangpy#1087 (08-05).** Our tracking comment `5164070567` was created 08-03T08:31:39Z and **edited in place** through 08-03T15:25:00Z. That edited body stated, correctly and prominently: fix landed as draft PR #1088, `skallweitNV` **APPROVED**, CI **green**, only promotion+merge left, and the exact reason the merge is load-bearing on slang#11225.

On **08-05T18:00:05Z** — two days *after* that edit — `jhelferty-nv` commented on the same issue, tagging two more maintainers:

> @zangold-nv It looks like the bot is giving us a heads-up that slang#11225 we're working on **might cause some downstream issues** with slangpy?

A confirmed, root-caused, approved, CI-green, merge-ready fix was read as a speculative heads-up. The information was **on the page, one comment up, and current** — and it did not arrive.

## Why

GitHub fires a notification on comment **creation**, not on **edit**. Watchers who already saw (or skimmed, or auto-filed) the original body get nothing when it changes. So an edited comment is only read by someone who *re-opens the issue and re-reads a comment they've already seen* — which is close to nobody, and specifically not a human arriving fresh two days later.

## The rule

**Edit-in-place hygiene and being-read are different goals, and they can conflict.** The hygiene rule ("don't spam a thread with N status comments; edit the tracking comment in place") is about **thread noise**. It says nothing about **delivery**, and on a chain that has gone quiet it actively defeats delivery.

⇒ When the state change is one a human must **act on** — promote, merge, approve, re-dispatch, decide — ask separately: *will anyone be notified that this changed?* If the answer is no and the chain has been idle, an in-place edit is the wrong surface for that particular fact, however good it is for the running log.

## How to apply

- Keep editing the tracking comment in place. It remains the right durable, single-source-of-truth artifact — this is not a license to spam.
- But treat **"the tracking comment already says it"** as a claim about *storage*, never about *receipt*. It is the exact sibling of a caveat in the wrong place: technically present, and it occupies the slot where delivery should have happened.
- Signals that an edit is insufficient: the chain has been idle for days · a human just arrived or tagged others in · the outstanding step is human-only (merge / promote / re-run) · your last edit predates their comment. That last one is decisive and cheap to check — compare your comment's `updated_at` against their `created_at`. **If they wrote after your edit and still have it wrong, the edit did not land.**
- The remedy is a **new** comment (or a direct nudge), because that notifies. Where posting is authorization-gated, that makes it an authorization question to raise explicitly — not a reason to conclude "already covered" and no-op. Silent reliance on an unread edit is the failure mode.

Related: [[feedback_github_comment_hygiene]] (the edit-in-place rule this one bounds), [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] (same shape: present-but-not-delivered reads as done), [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[project_11225_capability_target_incompat_slangpy_break]] (the chain).
