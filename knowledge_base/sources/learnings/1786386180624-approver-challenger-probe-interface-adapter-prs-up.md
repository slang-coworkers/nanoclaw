---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786384506930-nx1j7q
written_at: 2026-08-10T18:23:00.624Z
---

# [approver/challenger-probe] Interface-adapter PRs: upstream conformance tests do NOT run against your adapter

## Symptom

A PR implements an upstream interface locally and installs it process-wide
(slangpy#1098: `NanothreadTaskPool : rhi::ITaskPool`, installed for all of
slang-rhi via `rhi::getRHI()->setTaskPool(...)` in `static_init()`). Local tests
are added and look thorough — execution, payload cleanup, recursive task groups,
shared workers. Both bots came back clean-ish (CodeRabbit: 1 minor nit; Devin:
empty Flags). Easy to round up to approve.

## Root cause

The upstream project already owns a **conformance suite** for that interface —
and it runs against upstream's own implementations, never against your adapter.
slang-rhi's `tests/test-task-pool.cpp` has `testWorkStealingWaitTaskFromCallback`,
`testWorkStealingNestedWait`, `testWorkStealingWaitGroupFromCallback`, and
`task-pool-nested-group-wait-saturated-workers` — all exercising
`BlockingTaskPool`/`ThreadedTaskPool`. Substituting a new implementation silently
moves it outside that safety net, so the local test file is the *only* check on
the substitution, and its coverage gaps become the product's coverage gaps.

## How to catch it

For any PR that implements/replaces an upstream interface:

1. **Read the interface's documented contract at the pinned upstream commit**,
   not from memory — a submodule bump often *changes* the contract. Here the
   header specified a mode-dependent behavior: waiting outside a callback may
   execute *any* ready task, but from inside a callback "it executes only ready
   tasks from `group`" — and that narrower scope is what the doc cites as making
   callback-side waiting safe.
2. **Find upstream's conformance tests for that interface** and enumerate which
   contract directions they cover. Each one is a direction your adapter is now
   expected to satisfy with no upstream test watching.
3. **Apply the both-directions control per direction.** In #1098 the recursive
   test *looks* like callback reentrancy coverage, but the wait happens on the
   submitting thread while callbacks only submit — so the contract-blessed
   direction (wait from inside a callback) had zero coverage.
4. Reachability is a **contract** question, not a call-graph one. "Today's only
   caller happens to wait from the submitting thread" does not clear it — the
   documented, upstream-tested support IS the trigger.

## Fix

A contract direction that upstream blesses and conformance-tests, and that the
adapter's tests never exercise, is a specific nameable gap →
`ABSTAIN_POLICY:OPEN_GAP`, not a nit. The cheap remedy to recommend: run the
upstream conformance suite against the new adapter.
