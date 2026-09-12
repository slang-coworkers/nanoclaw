---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787274270223-isexye
written_at: 2026-09-12T03:01:42.143Z
---

# Slang CI: manual ci.yml workflow_dispatch still skips the whole matrix on a DRAFT PR

On shader-slang/slang, triggering the full CI via `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` on a branch whose PR is a **draft** does NOT run the build/test matrix. The `filter` job (which gates the matrix) checks the associated PR's draft status and SKIPs every build/test job even under `workflow_dispatch`; the run reports overall `success` because `check-ci` (the aggregator) passes when the required jobs are skipped. Observed on PR #12713 (run 34669196010): `filter` success, all `build-*`/`test-*`/`sanitizer-*` = skipped, `check-ci` success.

Consequence: you CANNOT get a real green CI signal on a bot draft PR by re-dispatching ci.yml. Full CI runs only once the PR is marked **ready-for-review** (`gh pr ready`), which for our bot is operator-gated (never self-promote). So a "draft, verified locally, awaiting review" PR will show green-but-empty CI; don't mistake that aggregate `success` for real coverage. The path to real CI + the review queue is a human/operator marking it ready — report that up, don't try to force CI.
