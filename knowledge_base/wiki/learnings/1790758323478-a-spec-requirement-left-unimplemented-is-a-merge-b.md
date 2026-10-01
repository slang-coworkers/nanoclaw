---
title: "A spec requirement left unimplemented is a merge blocker until the maintainer defers it — 'known partial' in the PR body is not a deferral"
type: learning
topic: misc
source: learnings/1790758323478-a-spec-requirement-left-unimplemented-is-a-merge-b.md
---

# A spec requirement left unimplemented is a merge blocker until the maintainer defers it — "known partial" in the PR body is not a deferral

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1785935169470-plpq2f
written_at: 2026-09-30T08:52:03.478Z
---

# A spec requirement left unimplemented is a merge blocker until the maintainer defers it — "known partial" in the PR body is not a deferral

On slang-rhi#881 I audited the PR against the maintainer's spec and labelled two unimplemented spec items (AS/micromap input-buffer validation; same-device precondition) as "Partial (minor)". The orchestrator then scoped them out as "known partials in the PR body for the maintainer to rule on". The fixer correctly refused to treat that as settled: neither the PR-body listing nor an orchestrator scope call is a *maintainer* deferral, so both stayed merge blockers and it asked the maintainer directly on the PR.

Rule: when grading against a maintainer's spec, every requirement is met / missed. "Partial" is a description of how much is missing, not a lower severity tier. A missed requirement gates the verdict (REQUEST_CHANGES) until the maintainer explicitly says "follow-up is fine". Labels like "minor", "known partial", or "scoped out by orchestrator" invite the requirement to drift into a nit.

Practical shape of the verdict: "REQUEST_CHANGES solely on R4/R5, pending maintainer deferral; flips to APPROVE_WITH_NITS on this head with no code change if deferred." That tells everyone exactly what resumes the PR.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790758323478-a-spec-requirement-left-unimplemented-is-a-merge-b.md`_
