---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786709677734-cyi17g
written_at: 2026-08-14T16:17:59.217Z
---

# [approver/challenger-miss] CORRECTION: "loud failure, not a false-pass" does NOT clear a 🟡 gap — the clearing bar is TRIGGER REACHABILITY

## Supersedes my earlier note on slang#12347
My prior learning ("test-infra PR with a dedicated CI lane that builds+runs the new target =
discriminating control for WOULD_APPROVE") over-reached on ONE gap. The CI-lane point still
stands for "does the target build and do the tests run". But I used it — plus "an uncaught throw
CRASHES = loud CI failure, not a false-pass" — to CLEAR gap #4 and reach WOULD_APPROVE. The
DECISION_REVIEW critique overturned that, and it was right. Final decision: **ABSTAIN_POLICY /
OPEN_GAP**.

## Symptom
slang#12347 adds a NEW test runner (`slang-internals-test-main.cpp`). Its per-test loop is
`startTest → getTestFunc(i)(&context) → endTest` with **no try/catch** (the existing slang test
runners carry a catch-all). A non-`AbortTestException` throw from any test propagates out,
terminates the whole suite, and hides the remaining tests' results for that run. The bot review
flagged this as a 🟡 gap (main.cpp:168). I cleared it as "robustness nit — a crash is loud, not a
false-green."

## Root cause of MY miss
I conflated two different properties:
- "not a false-green" (TRUE — a crash reddens CI) — this is about the FAILURE being loud.
- "inconsequential / clears the 🟡 bar" (FALSE) — this is about the TRIGGER being unreachable.
The skill's conservative-lean clearing bar is explicitly about TRIGGER REACHABILITY: a 🟡 clears
only if the trigger is unreachable on the supported path or clearly inconsequential. Whether the
resulting failure is loud or silent is IRRELEVANT to the bar.

## Why the trigger is reachable (the fact I under-weighted)
`SLANG_ASSERT` THROWS an exception when the `SLANG_ASSERT` env var is unset (shader-slang/slang
CLAUDE.md assertion-behavior table). Internals tests exercise IR/AST/checker internals — exactly
the code that fires `SLANG_ASSERT`. So a test hitting an assert throws, and the runner has no
catch to convert it into a recorded per-test failure + continue. Reachable trigger + real blast
radius (rest of the run's results lost) ⇒ OPEN_GAP. Two defensible readings = uncertainty ⇒
ABSTAIN, never round up.

## How to catch it next time
When tempted to clear a 🟡 with "it fails loudly / it's not a false-pass," STOP: that argues the
failure is observable, not that the trigger can't fire. Re-ask the ONLY clearing question: *can
this trigger occur on the supported path?* For a new test-harness gap specifically, check whether
the harness has the same exception/robustness envelope as the runner it's modeled on (here: the
missing catch-all vs the existing slang-unit-test runner). If the trigger is reachable, it's
OPEN_GAP regardless of how loud the failure is.

## Meta
This is the second-tier critique catching a false-clear before ship — the intended function of the
DECISION_REVIEW gate. A WOULD_APPROVE here would have been a false-safe (highest-severity error
class) if a maintainer later asked for the catch-all. Low-regret to abstain: routes to a human at
trivial cost.
