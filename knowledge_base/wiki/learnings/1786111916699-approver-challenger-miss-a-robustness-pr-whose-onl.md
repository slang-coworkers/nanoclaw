---
title: "[approver/challenger-miss] A robustness PR whose only new test forces the fallback path proves nothing about the retry it added"
type: learning
topic: review-approval
source: learnings/1786111916699-approver-challenger-miss-a-robustness-pr-whose-onl.md
---

# [approver/challenger-miss] A robustness PR whose only new test forces the fallback path proves nothing about the retry it added

## Symptom

slangpy#1094 ("Improve persistent cache robustness") raised `MAX_ATTEMPTS` 3→6 and
added exponential backoff + per-process jitter to LMDB cache opening. It shipped
exactly one new test:
`TEST_CASE_GPU("invalid_shader_cache_is_disabled_without_deleting_cache")` — which
writes 8 KB of `0xff` garbage as `data.mdb` so that **every one of the 6 attempts
fails**, then asserts the device comes up cache-less and the files survive.

Both bot reviewers (CodeRabbit, Devin) accepted the test plan. Neither noticed that
the test is **green by construction under any backoff schedule** — including zero
delay, a wrong-signed delay, or a loop that never retries at all. The headline
mechanism of the PR is verified by nothing.

## Root cause

The change is conditional (retry-until-success), and the test controls only one
direction:

- condition true → fallback taken (all attempts fail, degrade cleanly): **covered**
- retry actually recovers (a *transient* failure succeeds on attempt N): **covered nowhere**

A permanently-corrupt cache file can never exercise recovery — the input is
engineered so recovery is impossible. So the one test cannot distinguish a working
backoff from a broken one. Likewise the jitter (`current_process_id() % 17`), whose
entire reason for existing is de-correlating *concurrent processes*, is exercised by
no multi-process test.

This is the standing "conditional changes require a both-directions control" probe,
in a form worth naming because it is easy to miss: the test is not absent, and it is
not weak-looking. It is a real, well-written test of the *other* branch, and its
presence reads as coverage.

## How to catch it

For any PR whose value proposition is "retries / backoff / recovery / self-heal":

1. Name the mechanism's **success** direction in one sentence ("a transient lock
   contention succeeds on a later attempt").
2. Ask which test would go **red** if that mechanism were deleted or broken. If the
   answer is "none", the mechanism is unverified regardless of how many tests the
   PR adds.
3. Watch for inputs that make recovery *impossible by construction* — permanently
   corrupt data, a file that will never become valid, a resource that never frees.
   Those inputs can only ever test the give-up path.
4. Concurrency-derived values (pid, thread id, hostname) used for de-correlation
   need a multi-participant test or they are decorative.

Transferable form: **a test that exercises the failure branch of a retry is a test
of the fallback, not of the retry.** Count controls per direction, not per test.

## Fix

Called `ABSTAIN_POLICY:OPEN_GAP` on slangpy#1094 citing this as gap 3 — raised by
the challenger, not by either bot review. Recorded with the site
(`tests/sgl/device/test_device.cpp:62-97`) so the human reviewer can ask for a
transient-failure test that asserts a later attempt succeeds.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786111916699-approver-challenger-miss-a-robustness-pr-whose-onl.md`_
