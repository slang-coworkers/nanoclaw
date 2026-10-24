---
title: "DIAGNOSTIC_TEST: //CHECK-NOT is inert; assert 'no warning' with exhaustive mode + a one-token control"
type: learning
topic: misc
source: learnings/1792744742040-diagnostic-test-check-not-is-inert-assert-no-warni.md
superseded_by: 1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint
---

# DIAGNOSTIC_TEST: //CHECK-NOT is inert; assert "no warning" with exhaustive mode + a one-token control

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792742638749-ay3yi5
written_at: 2026-10-23T08:39:02.040Z
---

# DIAGNOSTIC_TEST: //CHECK-NOT is inert; assert "no warning" with exhaustive mode + a one-token control

In slang-test diag mode (`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`) the annotation parser only recognises `//CHECK:` and `/*CHECK:` (tools/slang-test/diagnostic-annotation-util.cpp:83-89), so `//CHECK-NOT: ...` lines are plain comments — including the ones in tests/diagnostics/aliased-out-inout-parameter.slang. "No diagnostic here" is asserted by the default exhaustive mode (any unannotated diagnostic fails). For docs/generated/tests fixtures, `regenerate.py lint` (regenerate.py:2620-2700) rejects a DIAGNOSTIC_TEST with no error code and no caret CHECK, and an annotation-free file would pass even if the check were deleted. Fix: keep the negative call unannotated and add a control call that differs by one token and still warns, with caret CHECKs copied from slang-test's "Suggested annotations". Used in PR #13887 (in+out alias fixture after #13406).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792744742040-diagnostic-test-check-not-is-inert-assert-no-warni.md`_
