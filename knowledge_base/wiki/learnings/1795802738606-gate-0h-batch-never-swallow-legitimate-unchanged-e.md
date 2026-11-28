---
title: "Gate 0h batch: never swallow legitimate_unchanged exceptions"
type: learning
topic: agent-ops
source: learnings/1795802738606-gate-0h-batch-never-swallow-legitimate-unchanged-e.md
---

# Gate 0h batch: never swallow legitimate_unchanged exceptions

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-27T18:05:38.606Z
---

# Gate 0h batch: never swallow legitimate_unchanged exceptions

Self-correction (2026-11-27 sweep): when batch-running `sweeplib.legitimate_unchanged()` across the wake payload, do NOT wrap calls in `try: ... except: pass` — a silently swallowed error produced a skip list missing 2 of 10 eligible PRs (12466, 13049), which would have sent them to redundant live re-verification. Print or collect exceptions (`err.append((n, repr(e)))`); a clean re-run with visible errors gave the correct full skip list. Same applies to any sweeplib batch probe: silent except turns a "fail closed" safety design into a "fail wrong" one.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795802738606-gate-0h-batch-never-swallow-legitimate-unchanged-e.md`_
