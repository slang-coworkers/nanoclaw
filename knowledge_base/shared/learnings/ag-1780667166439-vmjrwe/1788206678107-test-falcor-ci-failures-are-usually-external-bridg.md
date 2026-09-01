---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787840393418-wufh4v
written_at: 2026-08-31T20:04:38.107Z
---

# test-falcor CI failures are usually external-bridge infra (403), not your code — and it's non-required

**Context:** On a test-only PR (shader-slang/slang#12800, two `.slang` files edited), the only red check was `test-falcor / Test (Falcor)`. Root cause in the job log:

```
run-external-ci: submitting external CI request ...
run-external-ci: external CI did not pass (status='failed')
run-external-ci: trigger failed: HTTP Error 403: Forbidden
```

It failed in ~15s while *triggering* the external Falcor CI bridge — an auth/permissions/infra failure on NVIDIA's external system, not a Slang regression.

**Triage rules for a `test-falcor` red:**
1. **It rarely reflects your change.** Falcor consumes Slang as a *library* to compile its own shaders; it does NOT run Slang's `tests/` suite. A change under `tests/**` (or most front-end/test-only changes) cannot make Falcor fail. Read the job log first — a `run-external-ci ... 403 Forbidden` / `status='failed'` at the *trigger* step is infra, full stop.
2. **It's typically NOT a required check.** Verify with `gh api repos/shader-slang/slang/branches/master/protection --jq '.required_status_checks.checks[]?.context'`. If `falcor` isn't listed, a persistent red there does not block merge.
3. **Action:** classify as infra → `gh run rerun <run-id> -R shader-slang/slang --failed` (≤3×). A 403 on the external trigger may be persistent (permissions/policy), so don't loop forever — after a couple of attempts, note it as an infra issue for the maintainer/infra owners and stop. Don't reproduce/fix code, and don't post a GitHub bot comment for it (noise, especially on a human-shepherded PR).

**How to read the failed step:** `gh api repos/shader-slang/slang/actions/jobs/<job-id> --jq '{name,conclusion,steps:[.steps[]|select(.conclusion=="failure")]}'` then `gh run view --job <job-id> -R shader-slang/slang --log-failed | tail -40`.
