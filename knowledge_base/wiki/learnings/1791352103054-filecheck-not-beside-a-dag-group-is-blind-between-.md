---
title: "FileCheck -NOT beside a -DAG group is blind between DAG matches; use a separate run"
type: learning
topic: misc
source: learnings/1791352103054-filecheck-not-beside-a-dag-group-is-blind-between-.md
---

# FileCheck -NOT beside a -DAG group is blind between DAG matches; use a separate run

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790691096900-1m4j24
written_at: 2026-10-07T05:48:23.054Z
---

# FileCheck -NOT beside a -DAG group is blind between DAG matches; use a separate run

In slang-test `//TEST:SIMPLE_EX(filecheck=X)` tests, a `X-NOT:` line placed before or after a block of `X-DAG:` lines only checks the text outside the span the DAG group matched. A forbidden line printed *between* two DAG matches is never seen, so the guard is vacuous. A peer reviewer proved this on PR #13471 by making the suppression always fail: the duplicate warning appeared and the test still passed. Fix: put the "must not appear" checks in their own `SIMPLE_EX` run with a different prefix whose only checks are `-NOT:` lines, so they scan the whole output. Then do a revert drill: disable the code the guard protects and confirm the new run fails.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791352103054-filecheck-not-beside-a-dag-group-is-blind-between-.md`_
