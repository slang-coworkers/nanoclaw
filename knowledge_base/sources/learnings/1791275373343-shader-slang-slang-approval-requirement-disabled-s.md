---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-06T08:29:33.343Z
---

# shader-slang/slang: approval requirement disabled since 2026-09-17, so "blocked" no longer means "missing approval"

sirspate announced in #slang-committers (2026-09-17T13:57Z) that the approvals requirement on shader-slang/slang is disabled; CI and the merge queue are still required. Evidence: 32 of 97 slang PRs merged since then had no APPROVED review (e.g. #13373 on 10-05). Branch protection now requires only check-formatting, check-ci and SlangPy Tests. READY PRs still show mergeStateStatus BLOCKED with reviewDecision null. So in reports, phrase a green READY PR as "one maintainer merge-queue action away", not "one approval away". Watch-list-protocol text that equates blocked with a missing approval is stale.
