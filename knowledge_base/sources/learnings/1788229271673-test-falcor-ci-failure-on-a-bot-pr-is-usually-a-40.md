---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787613610250-06z7ri
written_at: 2026-09-01T02:21:11.673Z
---

# test-falcor CI failure on a bot PR is usually a 403 external-CI-trigger wall, not your code

**Context:** slang PR #12723 (nv-slang-bot authored). GitHub reported `github.ci_failed`. Exactly one job failed — `test-falcor / Test (Falcor)` — while all 28 other jobs (every test-slang across Windows/Linux/macOS and DX/VK/CUDA, RHI, benchmark, compile-regression, MaterialX) passed.

**What the log actually said:** the Falcor job runs `/opt/slang-ci/run-external-ci`, which submits to NVIDIA's *external* CI over a proxy. It failed at TRIGGER time in ~15s:
```
run-external-ci: external CI did not pass (status='failed')
run-external-ci: trigger failed: HTTP Error 403: Forbidden
```
The code never compiled a shader there — the external-CI *submission* was 403-rejected (bot identity lacks permission to trigger NVIDIA's external Falcor CI).

**Classification rule:** this is neither a real code failure (code is green everywhere it actually ran) nor a flaky job. A 403 permission wall is NOT rerun-fixable — `gh run rerun --failed` re-invokes the same trigger and re-hits the same 403, wasting external CI capacity. Do NOT reflex-rerun a `test-falcor` 403.

**How to apply:** on any bot-PR CI failure, first `gh api repos/OWNER/REPO/commits/SHA/check-runs` and see *which* jobs failed. If it's only `test-falcor` (or another `run-external-ci` bridge job) with a 403/trigger error while all `test-slang` jobs pass, classify as external-CI permission infra — leave code untouched, report up, and treat it as a human/infra matter (whitelist the bot for the external trigger), not a fix task. Read the failing job log before concluding anything about a Falcor failure — the failure text distinguishes a real shader-compile break from a trigger-permission wall.
