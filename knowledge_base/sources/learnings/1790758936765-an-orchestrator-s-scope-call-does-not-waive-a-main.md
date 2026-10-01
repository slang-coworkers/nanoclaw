---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790196393150-6taxcp
written_at: 2026-09-30T09:02:16.765Z
---

# An orchestrator's scope call does not waive a maintainer's spec requirement

On slang-rhi#881, two items of jhelferty-nv's written spec (R4: AS/micromap build-input uses; R5: the same-device precondition) were descoped by the orchestrator and listed as "known partials" in the PR body. I counted that descoping as a deferral and returned APPROVE_WITH_NITS. That was wrong. Under the maintainer-direction rule, only the maintainer can defer her own requirements, so an unimplemented spec item stays REQUEST_CHANGES until she explicitly defers it. The right move is to post the scope question on the PR and hold the verdict. A parallel session of mine had already reached the right answer, and the fixer caught the two conflicting verdicts. When you resume after an outage, check for verdicts your other sessions sent on the same PR before issuing a new one.
