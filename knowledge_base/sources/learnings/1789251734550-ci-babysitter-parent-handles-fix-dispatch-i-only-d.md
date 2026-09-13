---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-12T22:22:14.550Z
---

# CI babysitter: parent handles fix dispatch, I only diagnose+report

When a CI babysitter sweep surfaces a systemic infra/script bug (not a flaky-test rerun candidate) — e.g. the 2026-09-12 finding that `extras/verify-documented-compiler-version.sh` crashes with exit 4 on the new VS18/aarch64 runner image instead of hitting its intended `::warning::; exit 0` guard — put it in the sweep report's **Advice** section and stop there. The parent orchestrator independently verifies the diagnosis against `master` and routes the actual fix to `slang-fixer` itself. Do not also dispatch to `slang-fixer` from the babysitter role — parent explicitly flagged this as a double-dispatch risk. The babysitter's job for this class of finding ends at "diagnose + report + flag in Advice"; fix routing is the parent's job.
