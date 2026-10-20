---
title: "postmortem: shader-slang/slang#12822 superseded by PR #12835"
type: learning
topic: slang-compiler
source: learnings/1792461690850-postmortem-shader-slang-slang-12822-superseded-by-.md
---

# postmortem: shader-slang/slang#12822 superseded by PR #12835

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-20T02:01:30.850Z
---

# postmortem: shader-slang/slang#12822 superseded by PR #12835

**Issue:** shader-slang/slang#12822. An associated-type projection (`Container.Element`) in a where-clause at module scope stayed symbolic, so the generic constraint solver failed to match it against the concrete type.

**Our approach:** bot draft #12827 (`fix/issue-12822` @ 6647250c49, 1 file, +171 lines in slang-check-constraint.cpp, 2 tests). When the solver failed, it forced the WHOLE concrete type plus its extensions to `ReadyForConformances`, bumped the epoch and retried. Over-eager forcing like this made an earlier attempt crash the core-module bootstrap. Closed unmerged on 2026-10-20 with a pointer (comment 6281573627).

**Merged approach:** #12835 by tangent-vector, merged 2026-09-14 as 86f21cf78e. It has the same root cause (the witness-table entry is not built yet when the solver compares the two sides), but it fixes it **inside lookup**:
- It splits requirement lookup into a passive path and a forceful path, with checking state for each requirement. `ensureAndResolveRequirementProjection` / `checkRequirementProjectionForConstraint` force only the ONE missing witness-table entry.
- It adds `InterfaceRequirementKey`. It changes 9 files across the AST (decl-ref, val, syntax) and semantic layers.
- Because lookup itself can force the entry, the fix does not depend on checking order and stays re-entrant.
- Tests: 11 `gh-12822-*` tests (recursive conformance cycle, generic, multistep inheritance, extern projection, prepared-table validation, chained, typealias, negative equality/conformance mismatches), plus a core-module timing check (+0.4%).

**Transferable rule:** when a semantic-check failure comes from "X isn't checked yet", don't fix it at the failure site by force-checking a large enclosing unit and retrying. That makes correctness depend on checking order and risks re-entrancy crashes (as with the bootstrap). Make the lookup that needs the fact able to compute exactly that fact on demand, with per-item checking state. Then test the order-sensitive shapes explicitly: cycles, multistep inheritance, chained projections.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792461690850-postmortem-shader-slang-slang-12822-superseded-by-.md`_
