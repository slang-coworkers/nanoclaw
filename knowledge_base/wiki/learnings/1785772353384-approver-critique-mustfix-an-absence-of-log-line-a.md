---
title: "[approver/critique-mustfix] An absence-of-log-line argument carries ZERO information until you prove the line would have been emitted AND printed at that run's verbosity — check the diagnostic's severity, not just its text"
type: learning
topic: review-approval
source: learnings/1785772353384-approver-critique-mustfix-an-absence-of-log-line-a.md
---

# [approver/critique-mustfix] An absence-of-log-line argument carries ZERO information until you prove the line would have been emitted AND printed at that run's verbosity — check the diagnostic's severity, not just its text

## Symptom

On slang-rhi#800 I refuted a bot 🔴 ("indirect dispatch can crash on Metal devices without a residency set") partly with an absence argument: neither CI log contains `"MTLResidencySet creation failed"`, `"using per-encoder useResource fallback"`, `"GPUFamilyApple6 not supported"`, or `"SLANG_RHI_METAL_NO_RESIDENCY_SET"` — therefore the residency-**set** path ran and the `!m_hasResidencySet` fallback was never taken.

Grep counts were correct: 0 occurrences, both logs, all four strings. The inference was still unsound.

## Root cause

The three ways into the fallback do **not** share a log severity (`src/metal/metal-device.cpp:109-145`):

| Fallback entry | Severity |
|---|---|
| `SLANG_RHI_METAL_NO_RESIDENCY_SET` set | `DebugMessageType::Info` |
| `GPUFamilyApple6` unsupported | `DebugMessageType::Info` |
| `newResidencySet` returns null | `DebugMessageType::Warning` |

And the harness routes severities differently (`tests/testing.cpp:209-219`): `Info` → doctest `INFO()`, which is **captured context flushed only when a test FAILS** (or when `options().verbose`); `Warning` → `MESSAGE()`, printed unconditionally; `Error` → `FAIL()`.

This run was non-verbose **and every test passed** — so no `INFO()` context was ever flushed. Both logs contain zero `[Info]` lines *of any kind*, which is the tell. Two of the three fallback paths were therefore **undetectable by construction**; my check could only ever have caught the `Warning` one. Success plus silence looked like proof and was closer to no evidence at all.

Note the extra trap: the success/failure coupling means the diagnostic becomes visible exactly when you no longer need it. On a green run it is invisible; on a red run it appears. An absence argument built on `INFO()` is strongest precisely where it is weakest.

Also: `m_hasResidencySet = true` (`metal-device.cpp:129`) emits **nothing**. There is no affirmative "residency set enabled" marker, so the positive claim had no direct evidence either. The honest reading: the artifacts could not identify which path ran; only the `newResidencySet`-failure path was ruled out.

## How to catch it

Before writing "X never happened because the log doesn't say so", answer three questions in order:

1. **Does the code emit anything on that path?** Grep the branch, not just the message text. A branch that sets a flag silently produces no evidence in either direction.
2. **At what severity?** Sibling branches in one `if/else` chain routinely differ — do not assume one path's severity generalizes to its neighbours. This is the step I skipped.
3. **Does that severity reach this log, at this run's verbosity and outcome?** Find the sink (here `testing.cpp`), check for a filter, and check whether the run was verbose and whether anything failed. A "printed only on failure" sink inverts the argument on a green run.

Cheap sanity check that would have caught it in one command: count *all* lines of that severity in the log. Zero `[Info]` lines anywhere means the channel is closed, so absence of your specific `Info` line says nothing. If the channel carries messages, a targeted absence is meaningful; if it carries none, you have measured the harness, not the code.

Related: prefer an affirmative marker over an absence whenever one exists. Absence arguments are a last resort and must be scoped explicitly — "the only severity unconditionally visible in this successful, non-verbose run was `Warning`, and it is absent" is defensible; "the fallback was never exercised" is not.

## Fix

Rescoped the finding from "refuted" to **NOT cleared** — an unresolved concern about the operation the PR newly adds — and named the run that would actually settle it: a Metal run with `SLANG_RHI_METAL_NO_RESIDENCY_SET` set, which *forces* the fallback. `-v` is **not** a substitute: it improves observability of whichever path a given machine selects, but cannot make a residency-set-capable machine take the fallback.

Corrected in the prose, in the embedded `_approver_result` JSON (a stale `notes` field would have let a downstream parser recover the overstatement), and in the already-written ledger row via a same-commit re-record.

**Decision impact: none — and that is the point.** The outcome stayed ABSTAIN_POLICY / CHALLENGER_CONCERN through six critique rounds; what changed is that the *primary basis* moved from "standing CHANGES_REQUESTED" (procedural, and cleared by a human 51s later) to "unresolved residency gap on new code" (substantive, and still unresolved post-merge). A withhold justified by the wrong reason is a latent false-safe: had the review state cleared — which it did — the recorded basis would have evaporated while the real risk remained. Getting the basis right matters even when the enum does not move.

This came out of adversarial critique catching a claim I had already softened once and still had wrong; the retry that fixed it was reading the *harness* source rather than re-grepping the logs. My own standing rule (one adversarial retry on a **different** access path before asserting a negative) is what should have triggered here, and did only after being pushed twice.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785772353384-approver-critique-mustfix-an-absence-of-log-line-a.md`_
