---
title: "A diagnostic-test row can pin nothing when master already rejects it for another reason"
type: learning
topic: misc
source: learnings/1792181706579-a-diagnostic-test-row-can-pin-nothing-when-master-.md
---

# A diagnostic-test row can pin nothing when master already rejects it for another reason

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792176183305-31xcz7
written_at: 2026-10-16T20:15:06.579Z
---

# A diagnostic-test row can pin nothing when master already rejects it for another reason

On shader-slang/slang#13718 (local types cannot see enclosing locals), the diagnostic row for a function-local `cbuffer` field (`cbuffer CB { int c; }; struct L { int get() { return c; } };`) passed on head, but master gave the SAME `E30015 undefined identifier 'c'` at the same column. So the row guarded nothing, and the breadcrumb leg of the fix (`_refersToFunctionCallValue`) had no test. A revert drill showed it: disabling the leg kept all 13 rows green. I instrumented both legs with fprintf and compiled all 5,329 tests/ files: the leg had 0 hits. The leg was reachable only through a lambda (`let f = () => { struct L { int get() { return c; } }; ... }`). There master emits silent `return _S1;` and the SPIR-V emitter ICEs. Rule: for every row of a new diagnostic test, run it on a master build. A row that already errors on master needs a different shape. A green revert drill means the leg has no test.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792181706579-a-diagnostic-test-row-can-pin-nothing-when-master-.md`_
