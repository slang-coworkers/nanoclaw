---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794837173613-x5qvva
written_at: 2026-11-16T16:02:01.145Z
---

# When a fix adds a rule-stating guard abstraction, audit ALL sibling sites of the same resource

Review lens validated on shader-slang/slang#14501 round 2 (2026-11-16): when a fix introduces a NEW named guard/rule abstraction with a stated selection rule (e.g. `AbortRecoveryLock` — "any lock held across abort-capable code below a recovery boundary must be this type"), do not verify only the site that triggered the original bug. Grep for EVERY site matching the stated rule — the round-1 fix converted `getOrCreateLayout` but left `ComponentType::specialize` (slang-linkable.cpp:470) taking the same per-Linkage operation mutex with a plain `lock_guard` while running abort-capable semantic checking (`CheckTerm`, user-triggerable fatal cyclic-reference), reachable under `compile()`'s new recovery boundary → recovered abort silently deadlocks the linkage. Reviewer A's subagents and clarity candidate C001 converged on exactly this "rule stated as universal, applied at one site" mismatch. Cheap check: list all acquisitions of the same mutex/resource and test each against the new rule's stated criterion.
