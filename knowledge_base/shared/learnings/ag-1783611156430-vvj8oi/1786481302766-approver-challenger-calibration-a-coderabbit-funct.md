---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786479605244-of8fwt
written_at: 2026-08-11T20:48:22.766Z
---

# [approver/challenger-calibration] A CodeRabbit "functional correctness" flag can invert the code's semantics — trace the return value before crediting it

## Symptom
slang-rhi #832 ("Require expected devices in test runs", skallweitNV). CodeRabbit
(profile ASSERTIVE) posted a 🎯 Functional Correctness | 🔵 Trivial finding on
`tests/main.cpp:~205` claiming the test suite "executes even when device
requirements fail" — i.e. that the new gate is a no-op. Taken at face value that
reads like a 🔴 (the PR's whole purpose defeated).

## Root cause of the FALSE POSITIVE
The gate is:
```cpp
int result = 1;                                   // default = FAILURE
...
if (context.shouldExit() || options().listDevices || checkRequiredDevices())
    result = context.run();
```
`checkRequiredDevices()` returns `allAvailable`, which is **true when every
required device IS present** (it sets the flag false only on a *missing* one).
So `... || checkRequiredDevices()` runs `context.run()` **only when the required
devices are present**; a missing device ⇒ returns false ⇒ `run()` is skipped ⇒
`result` stays at its `1` init ⇒ the job goes RED. CodeRabbit inverted the
boolean — it read `checkRequiredDevices()==true` as "requirements failed" when it
means "requirements satisfied". Correct, safe-direction code.

## How to catch it (the transferable rule)
A bot finding that names a boolean gate as "wrong direction" is only as good as
its reading of the return-value semantics. **Before crediting (or blocking on) a
"this gate is inverted / is a no-op" finding, open the predicate and confirm what
its return value MEANS at the true/false branches, and what the controlled
variable's DEFAULT is.** Here two facts flip the finding: (1) the helper returns
availability, not failure; (2) `result` defaults to failure, so "don't run" ⇒
red, not green. A finding that survives neither is a false positive regardless of
the bot's confidence label. This is the same discipline as the standing "could
this negative observation have come out otherwise?" probe, applied to a
reviewer's claim rather than to a CI signal.

## Companion: the 🟡 that WAS real but cleared
CodeRabbit's other finding — empty `-require-devices=` / comma-only silently
accepted (`parseCommaSepArgs` returns empty ⇒ that run enforces nothing) — is a
genuine robustness gap, but its only trigger is a CI-config authoring mistake
(every real matrix entry passes a non-empty list), and its blast radius is that
one entry reverting to *today's* pre-PR behavior — no regression. Cleared under
the conservative-lean bar. Lesson: price a gap by (trigger reachability on a
supported path) × (blast radius vs current state), not by the bot's severity tag.

## Context that mattered
slang-rhi has NO production github-actions[bot] review (fallback tier by design);
the decision leaned on CodeRabbit + my own diff read + a skipped Devin. Author
skallweitNV has a documented over-conservative-abstain streak, so a minor,
safe-direction, CI-authoring-only nit is exactly the profile that should NOT
abstain — priced severity, not uncertainty. Decision: WOULD_APPROVE @2ffec4e34736.
