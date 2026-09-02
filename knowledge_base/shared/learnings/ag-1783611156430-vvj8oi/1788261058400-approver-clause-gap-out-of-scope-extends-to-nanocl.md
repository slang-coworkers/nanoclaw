---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788260716625-o6rbzz
written_at: 2026-09-01T11:10:58.400Z
---

# [approver/clause-gap] OUT_OF_SCOPE extends to nanoclaw coworker-MCP-tooling PRs; new fleet tooling ≠ approver-harness COI

**Symptom.** A `slang-coworkers/nanoclaw` PR (#1402, "coworker-mcp — MCP server to talk to coworkers + inspect cost", 500 add / 0 del across `scripts/coworker-mcp/{README.md,coworker-mcp.mjs}`) was routed to the approver "as the general approver" because no nanoclaw-specific approver exists. Mechanical clauses gave a mixed result (PASS author_trust/head_provenance/no_protected_paths; FAIL tier_eligible 500>400; UNEVALUABLE commit_match + ci_green_on_sha), which naively points at CLAUSE_FAIL / CLAUSE_UNEVALUABLE, and harvest exit 20 looks identical to the NO_REVIEW_SIGNAL infra trigger.

**Root cause.** `slang-coworkers/nanoclaw` is a NanoClaw fleet-infrastructure repo, outside the shader-slang compiler domain the v0-shadow policy + eligibility clauses are calibrated for. Repo-class OUT_OF_SCOPE has no scripted predicate — it must be recalled from precedent (nanoclaw-changelog-docs; nanoclaw#1145) — and it fires FIRST, overriding the mechanical clause→outcome mapping and the harvest-20 → NO_REVIEW_SIGNAL mapping.

**Decision.** ABSTAIN_POLICY, reason_code `OUT_OF_SCOPE:nanoclaw-infra` (policy family, system-working-as-intended — NOT ABSTAIN_INFRA, the pipeline ran cleanly). Never rounds up to WOULD_APPROVE (no applicable review signal), never BLOCK (no verified bug).

**New nuance (class + COI boundary).** This extends the OUT_OF_SCOPE class families beyond docs (`website-content`, `course-materials-docs`, `nanoclaw-changelog-docs`) and the sharp `approver-harness` COI: a PR adding a **new** fleet MCP server is fleet tooling the approver is embedded in (mild COI-adjacency) but does **NOT** modify the approver's own decision instrument (harvest-reviews.py / collect-reviews.sh / devin-fetch.sh / eval-clauses.py / APPROVAL_POLICY.json / the skill). So the nanoclaw#1145 approver-harness COI ground does NOT apply — ground the abstain on repo-class alone and note the fleet-tooling adjacency as secondary. The COI ground is reserved for changes to the instrument that produces the review signal or the rules decided by.

**How to catch it.** Before any merits/clause reasoning on a routed PR, ask two things: (1) is the repo inside the compiler domain (shader-slang/slang, slang-rhi)? If not → OUT_OF_SCOPE regardless of a clean or mixed clause run. (2) do the changed paths touch the instrument that produces my review signal or the rules I decide by? If yes → add a COI ground; a new adjacent tool is not enough.
