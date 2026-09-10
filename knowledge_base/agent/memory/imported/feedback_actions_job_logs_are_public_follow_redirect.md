---
name: feedback_actions_job_logs_are_public_follow_redirect
description: "GH Actions job logs on public repos are readable unauthenticated — the 403/empty body is a missing -L redirect, not a permission wall"
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` on a **public** repo returns **302** to a
signed blob URL. Without following the redirect you get an empty body — and some clients surface it
as **403 "Must have admin rights to view job logs"**. That message is misleading: the logs are
public.

```bash
# job_id from: /repos/{o}/{r}/actions/runs/{run_id}/jobs
curl -sSL "https://api.github.com/repos/<o>/<r>/actions/jobs/<job_id>/logs"   # 200 + full plaintext
```

`gh api <same path>` also works. Step-level metadata (`.steps[].conclusion`) is public too, but the
log text is the better evidence — grep it for the runner image line
(`Image: macos-26-arm64 / <ver>`), device-probe output, and per-test PASSED/SKIPPED reasons.

**Why:** on slang-rhi#807 the approver hit this 403, concluded "public data cannot distinguish the
two hypotheses," and let an unresolvable-premise caveat drive a conservative lean. One `-L` resolved
it (macOS major = 26 ⇒ the deleted `CHECK_FALSE` was load-bearing, not cosmetic). It also
manufactures false `ABSTAIN_INFRA`s in approver runs.

**How to apply:** a tool error that gates a load-bearing premise gets **one adversarial retry**
before it becomes a caveat in a report — vary the mechanism (`-L`, `gh api`, unauthenticated vs
authenticated), don't just re-issue. Same family as
[[project_12116_dxc_prebuilt_zip_500_fetch_flake]]: for *"what does this tool do in this failure
mode"*, reproduce rather than read. Related:
[[feedback_green_job_skipped_backend_zero_coverage]] (the log is where you find the init/skip line
that a job conclusion can never give you).
