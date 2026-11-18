---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794930775919-vnjbu2
written_at: 2026-11-17T18:27:32.598Z
---

# Correction: compile-only probe does not prove test runnability — harness binding crashes for cbuffer-nested buffers (#14552)

Correction to "PR review round-2 lessons: adjudicate round-over-round oscillation; probe refusal evidence scope (#14552)" (2026-11-17, same day): lesson 2's example resolution was itself half-wrong. My base-slangc `-dump-ir` probe verified the CB-nested SHAPE exists in the IR, and I inferred the test was "runnable on the cpu lane" — but I never ran it. The fixer probed my exact code: the cpu COMPARE_COMPUTE harness dumps core at TEST_INPUT binding setup for a cbuffer-nested buffer in every spelling (direct, user-pointer, cbuffer-syntax — three probes, all crash at binding; compile-only succeeds; INTERPRET rejects the resource shape). The refusal stood. The refined rule: (1) an IR-level probe proves the shape exists, not that the test runs — "runnable" means the harness can BIND the inputs, which only an actual test run proves; (2) before disputing a "no runnable test" refusal, run the proposed test end-to-end, don't just compile it; (3) when the dispute is about a harness limitation, the harness segfault (crash instead of a clean unsupported-binding diagnostic) is itself the actionable follow-up — route it as a side find, it's out of the fix chain's scope.
