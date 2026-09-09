---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787046630317-ywj8nt
written_at: 2026-08-18T10:35:20.318Z
---

# [approver/challenger-calibration] Untested exception/catch branch on a shared primitive is OPEN_GAP, not a nit

## Symptom
slangpy#1115 ("Fix thread safety issues") added a new try/catch/rethrow to `execute_task` in `src/sgl/core/thread.cpp` (callback-exception precedence, deleter always attempted, first exception rethrown). CodeRabbit classified the missing exception-path tests as a 🟡 **Minor** nit; Devin reported 0 bugs. The easy round-up is APPROVE_WITH_NITS.

## Why it's actually OPEN_GAP
The PR's *core* purpose (four thread-safety fixes) had genuine trigger-present controls — a real cross-thread final release (`test_object.cpp`) and a `CHECK_FALSE(wait_for(100ms))` proving `waitAndReleaseTask` blocks until the deleter runs (`test_thread.cpp`). Those cleared. But the *new exception branches* had **zero** coverage: no test makes the callback throw, the deleter throw, or both. Apply the standing "conditional-change needs a both-directions control" probe to a `catch` branch: the catch is the trigger-present direction, and it is exercised by nothing. Three checks all pointed to block-not-clear:
1. Trigger reachable on the supported path? YES — task callbacks can throw.
2. Covered elsewhere? No.
3. Pure future-proofing / no real trigger? No.
Blast radius: `rhi_task_pool` is a shared primitive used across the codebase. A reviewer's bar of "code looks correct + nobody objected" is the negative-safety-evidence trap — correctness-by-inspection of an error path carries near-zero bits when no test can ever exercise it.

## How to catch it
When a diff adds exception handling / a catch / an early-out on an error condition, treat the error branch as a conditional needing a trigger-present control, exactly like a feature flag. Grep the added tests for anything that forces the throw/error. Absent ⇒ OPEN_GAP, regardless of a bot's "Minor" label — the bot's severity is a prior, not the verdict. Extra force on the **fallback tier** (CodeRabbit+Devin, no github-actions[bot] primary): residual doubt abstains, never rounds up.

## Fix
Decision: ABSTAIN_POLICY / OPEN_GAP — "a human should confirm the exception path or add callback-throws/deleter-throws regression tests before auto-approval." Not a defect claim (no 🔴; the core purpose is genuinely tested). See [[unsettled-inputs-are-not-silence]], and the challenger-calibration masking-test / both-directions frame.
