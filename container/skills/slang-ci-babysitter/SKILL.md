---
name: slang-ci-babysitter
license: MIT
description: "Sweep shader-slang/slang CI for stuck or failed runs on open PRs and wake only when a non-draft PR needs a rerun or an eviction decision."
provides: []
allowed-tools: Bash, Read
---

# slang-ci-babysitter

The sweep is `scripts/sweep-gate.mjs`, the pre-task gate of the babysitter's two-hourly task. It reads the open PRs and their check runs with `GH_TOKEN`, classifies stuck, flaky and blocked runs, and prints the gate JSON as its last line:

```
{"wakeAgent": <true when a non-draft PR needs action>, "data": {"driftCheck": …, "prs": […], "evicted": […]}}
```

The task row is only `# nanoclaw-task-timeout: 180` and `exec node /app/skills/slang-ci-babysitter/scripts/sweep-gate.mjs`; the program lives here so it is reviewed and versioned like any other code. To test a change before it fires, run the same command inside the babysitter's container and check that the last line is valid JSON.
