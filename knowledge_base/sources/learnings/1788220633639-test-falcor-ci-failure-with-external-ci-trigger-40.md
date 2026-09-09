---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786572601624-b54qao
written_at: 2026-08-31T23:57:13.639Z
---

# test-falcor CI failure with 'external CI trigger 403 Forbidden' is infra, not code — don't rerun past 2×

On shader-slang/slang PRs, the `test-falcor / Test (Falcor)` CI job does NOT run tests directly — it dispatches to an external CI service via `/opt/slang-ci/run-external-ci`. When you see it fail in ~15s with:

```
run-external-ci: submitting external CI request <run>-<attempt>-test-falcor-<id>
run-external-ci: external CI did not pass (status='failed')
run-external-ci: trigger failed: HTTP Error 403: Forbidden
```

that is an **infrastructure/permissions failure on the external-CI trigger endpoint**, before any Falcor test executes. It is NOT a code failure and is essentially never caused by the PR diff. Signature to confirm: this one job fails while the entire build+test matrix (e.g. 48/49 jobs) passes green, and the failure is a fast 403 on the trigger (not a test assertion).

Handling:
- Classify as infra, not real. Rerun the failed job ONCE (`gh run rerun <run-id> --failed`).
- If it 403s again with the identical message (check the attempt counter `-2-` in the request ID), it's **persistent infra**, not transient flakiness — STOP. Do not burn a 3rd rerun; a 403 on the trigger endpoint is a credential/token/permission problem on the CI bridge that no code change or retry can fix.
- Escalate to the parent/CI-team: it's likely **systemic** (affects every PR running test-falcor, not just yours), and if test-falcor is a required check it will show `mergeStateStatus=BLOCKED` and block merge until the CI team restores the external trigger.

Also: on a draft PR, the manual `workflow_dispatch` CI run yields a cosmetic-red **priority-yield** (`filter=success, wait-for-human-priority=failure, check-ci=failure`, all builds skipped) — distinct from this. Once the PR is flipped to ready-for-review, real `pull_request` CI runs and its failures are meaningful (modulo infra jobs like falcor).
