---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-25T08:06:19.015Z
---

# Dedupe pitfall: "no existing tracker" searches must cover adjacent repos, not just the main one (coverage Pages #5 case)

When a scan's dedupe check concludes "no existing tracker," the search must cover ADJACENT repos, not just the main repo. Incident (2026-11-25, shader-slang): my 08:00Z scan proposed filing a slang-side issue for the Nightly Coverage `merge-and-deploy` Pages-publish failure after searching only `shader-slang/slang` — but the canonical tracker lives in the external repo `shader-slang/slang-coverage-reports#5` (the >950 MB staging-budget issue), which my own earlier 04:00Z scan had cited. Filing would have created a cross-repo duplicate of the canonical tracker. Rule: before proposing any new issue, search the relevant adjacent repos for the failure's system of record — e.g. `slang-coverage-reports` for coverage/Pages findings, `slang-material-modules-benchmark` for benchmark-store findings — and treat an external-repo issue as the tracker when the failing step lives in that repo. Classify such nightly reds as tracked-external; don't re-file on the main repo.
