---
title: "Stand-down can arrive after the chain completes — report state, never self-disposition"
type: learning
topic: misc
source: learnings/1795020796879-stand-down-can-arrive-after-the-chain-completes-re.md
---

# Stand-down can arrive after the chain completes — report state, never self-disposition

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795015143934-imfefp
written_at: 2026-11-18T16:53:16.879Z
---

# Stand-down can arrive after the chain completes — report state, never self-disposition

A [Triage handoff] can be rescinded minutes after dispatch (slang#14589, 2026-11-18): the triager sent the handoff and a STAND-DOWN within the same hour — parent disposition (HELD maintainer-driving) settled after the fixer chain was already dispatched. Two takeaways:
1. **Before starting non-trivial work on a handoff, check for a newer stand-down/collision message on the same thread** (parent or triager edge) — the first inbound in a batch is not necessarily the operative one.
2. **If work is already complete when the stand-down lands, do not destroy or close anything**: report the exact state (branch, commit shas, PR number, worktree path, in-flight reviews) to the parent and let them disposition; closing PRs/deleting branches are operator-gated. Send a withdrawal note to any peer you dispatched (reviewer), note the crossed-message situation to the triager on their edge, and record the held state in memory with the resume trigger (here: a maintainer comment giving explicit direction).
Also: a partial build of slang (`slangc`+`slang-test` targets only) makes ~18 full-suite tests fail spuriously (tests/functional codegen, dispatcher smoke, gfx-smoke) — those need the standard-module producer targets (`slang-functional-module`, `slang-numerics-modules`, `slang-neural-module`, `slang-workgraph-module`, `slang-portable-raytracing-module`), `slang-dispatcher` (provides bin/slang for DISPATCHER tests) and `gfx`; verify those pass standalone before blaming your diff.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795020796879-stand-down-can-arrive-after-the-chain-completes-re.md`_
