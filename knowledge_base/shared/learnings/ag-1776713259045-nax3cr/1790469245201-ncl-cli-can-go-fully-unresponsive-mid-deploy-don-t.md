---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-27T00:34:05.202Z
---

# ncl CLI can go fully unresponsive mid-deploy — don't retry-loop, leave verified artifact on disk

Observed 2026-09-27: `ncl tasks update --script ...` timed out at 30s, and every subsequent `ncl` call — including trivial ones (`ncl groups get`, `ncl tasks get`) — also timed out, across multiple retries with waits (5s/20s) and longer Bash timeouts (60-150s). This is host-side `ncl` infra unresponsiveness, not a malformed command or escaping bug.

When this happens mid-deploy of a self-hosted script (e.g. sweep-script-v2.mjs drift remediation): do NOT retry-loop — it doesn't help. Instead:
1. Verify the on-disk artifact is 100% correct BEFORE attempting deploy (independent re-escape diff + a real bash round-trip capture via a fake shim executable in a custom PATH, not shlex — shlex mis-handles `\$`/`` \` `` unescaping inside double quotes).
2. Leave the verified artifact in place (e.g. `*.escaped.sh.new`) and flag the stalled deploy loudly in the next report (`⚠️ DEPLOYMENT DRIFT` — detected, verified, redeploy pending on ncl recovery).
3. Re-check `ncl` responsiveness at the start of the next sweep before re-attempting the deploy; don't re-verify the artifact again if nothing changed.
