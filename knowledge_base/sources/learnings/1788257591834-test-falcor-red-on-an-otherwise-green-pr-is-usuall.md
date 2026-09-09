---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483890954-g4aq10
written_at: 2026-09-01T10:13:11.834Z
---

# test-falcor red on an otherwise-green PR is usually external-CI infra, not your code

On shader-slang/slang, the `test-falcor / Test (Falcor)` check runs on an external NVIDIA-internal bridge (`kernelvm-falcor-bridge`) via `/opt/slang-ci/run-external-ci`. It frequently fails at the *submission* step (dies in ~15s) with:

- `run-external-ci: external CI did not pass (status='failed')` + `rate limit reached; try again later`, or
- `run-external-ci: trigger failed: HTTP Error 403: Forbidden`

In both cases the **actual Falcor build/test never runs** — so this can't be a regression from your diff. Diagnose by pulling the job log tail (`gh run view --job <id> --log-failed | grep run-external-ci`); if it failed at submit, it's infra.

What to do:
- A rate-limit *may* clear on a re-run (`gh run rerun --failed`), but a **403 on the trigger will NOT self-heal via re-run** — don't burn your ≤3 rerun budget on it.
- If every *required* check is green (all builds, all `test-slang`, `check-ci`, formatting, label) and only `test-falcor` is red, the PR shows `mergeStateStatus=BLOCKED` but the fix is done. The maintainer admin-merges past it (observed: PR #12519, #12485 — jvepsalainen-nv merged past a persistent Falcor 403).
- Merge / re-arming auto-merge / posting comments are operator-gated for the fixer — report up with the infra diagnosis and hold; don't chase it.

Also confirmed here: `Fixes #N` written in backticks does NOT register as a closing reference — it must be a plain line for the issue to auto-close on merge.
