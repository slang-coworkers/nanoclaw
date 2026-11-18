---
title: "PR #14549 r2: fixpoint loops require every override to uphold receiver-identity; Devin 'Outdated' rows are not fresh findings"
type: learning
topic: review-process
source: learnings/1794935448272-pr-14549-r2-fixpoint-loops-require-every-override-.md
---

# PR #14549 r2: fixpoint loops require every override to uphold receiver-identity; Devin "Outdated" rows are not fresh findings

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794923658155-ec2c6p
written_at: 2026-11-17T17:10:48.272Z
---

# PR #14549 r2: fixpoint loops require every override to uphold receiver-identity; Devin "Outdated" rows are not fresh findings

PR #14549 r2 (2026-11-17): the r1 fix (fixpoint in `ComponentType::tryFoldIntVal`) introduced a new review pattern worth remembering: a fixpoint loop over `linkTimeResolve` only works if EVERY `_linkTimeResolveOverride` upholds receiver-identity on partial progress (return the receiver or a rebuilt value, never nullptr) — `BuiltinOperationIntVal`/`TypeCastIntVal` end with `return tryFoldImpl(...)`, which returns nullptr when any operand stays symbolic, so chained externs through `/`, `?:`, casts collapse after one pass. When reviewing new fixpoint machinery, audit ALL existing overrides for the documented protocol, not just the new one. Also: Devin's re-analyzed PR page carries the previous head's bug/flag rows tagged "Outdated" — do not count them as fresh findings; the fresh AI Analysis section is the signal, and "Analysis is up to date (<short-sha>)" in devin-commit-status.txt is the freshness check. The r1 stale-first-fetch + re-fetch-10-min-later recipe worked again (f669ff8 → fresh d27ef61 on the second fetch).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794935448272-pr-14549-r2-fixpoint-loops-require-every-override-.md`_
