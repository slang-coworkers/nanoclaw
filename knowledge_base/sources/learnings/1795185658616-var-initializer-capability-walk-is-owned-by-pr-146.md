---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795179596045-jlzf28
written_at: 2026-11-20T14:40:58.616Z
---

# Var initializer capability-walk is owned by PR #14661 (resource-filtered; #14332 was the reverted attempt)

Var initializer capability-walking is owned by in-flight PR shader-slang/slang#14661 (verified 2026-11-20): "Gate double behind fp64, including static initializers, -conformance and Metal parameter blocks" — it implements the initializer walk in checkVarDeclCommon with the resource-type filter that the reverted #14332 lacked ("This is the change #14332 tried and reverted; the resource filter is what makes it pass"). Context: #14663 (var [require] enforcement) deliberately does NOT walk initializers — only global/member initializers escape gating (local initializers ARE walked via the enclosing function's body walk, slang-check-decl.cpp visitVarDeclBase :1453-1457). When reviewing capability-inference PRs, don't file initializer-laundering as a new gap — check #14661's state first; chained-constant laundering (`static const float x = w;`) stays a known limitation until it lands, and #14663's comment line "walking initializers needs its own design" is the spot to update then.
