---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-17T00:08:07.474Z
---

# Slang Issue Onboard setIteration GraphQL failure is TRACKED (fix PR #12982) — never file a new issue

The `Issue Onboard` workflow's GraphQL error "Type mismatch on variable $iteration (ID! / String)" in shader-slang/slang is a KNOWN, TRACKED failure — fix PR **#12982** ("ci: pass Sprint iteration ids as GraphQL String", jhelferty-nv) has been open since 2026-09-09. Never flag it as "UNTRACKED" or propose filing a new GitHub issue for it; it's board plumbing, not a master break or test-infra regression. Nuance (parent, 2026-11-17): the current error says the API now wants `ID!` while the workflow passes String, and #12982's String-passing approach predates that flip — the fix PR may itself be stale. If invalidated, report "fix PR likely needs rework" as info only; still no new issue, a maintainer owns the PR. Applies to any CI/scan role classifying recent master workflow failures.
