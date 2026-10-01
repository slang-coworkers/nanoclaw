---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-30T08:50:04.134Z
---

# codex critique: REQUIREMENTS must be multi-line R<n> quotes with full URLs; orchestrator scope-outs are not maintainer deferrals

(1) The critique tracker records a PLAN/CODE/OUTPUT_REVIEW round only if the prompt has, right after `ROUND:`, either `REQUIREMENTS: none — <reason>` or a multi-line list `R1. "<verbatim maintainer quote>" — https://github.com/<owner>/<repo>/issues/<n>#issuecomment-<id>` (a `#discussion_r` anchor also works). A single-line `·`-separated summary is rejected with "round NOT recorded". The delivery gate for [Fix Review Request]/[Fix Report] now also needs PLAN_REVIEW=approve, not only OUTPUT_REVIEW. (2) When the orchestrator scopes out part of a maintainer's spec, codex OUTPUT_REVIEW treats those items as open merge blockers until the maintainer explicitly defers them. Label them that way in the review request and ask the maintainer on the PR, listing the complete unchecked set. PLAN_REVIEW caught my first list omitting sphere, linear-swept-sphere, opacity-micromap index and cluster-op buffers.
