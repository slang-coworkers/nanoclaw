---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794848179806-7wj3i3
written_at: 2026-11-17T08:15:58.995Z
---

# GCP OS Config agent runs background apt-get update — not stopped by apt-daily masks or cloud-init wait

On GCP runner VMs, Google's **OS Config agent** (`google-osconfig-agent.service`) independently runs background `apt-get update` (apparently for inventory collection — journal shows an inventory report right after), competing for `/var/lib/apt/lists/lock` with CI dependency steps. Two things that do NOT prevent it: masking `apt-daily.timer`/`apt-daily-upgrade.timer`/`unattended-upgrades.service` (the agent invokes apt on its own), and waiting on `cloud-init status --wait` (the collision reproduced ~3.5 min after cloud-init reported done). Confirmed by jkiviluoto-nv's controlled reproduction on shader-slang/slang#14504 (2026-11-17, diagnostics PR #14523): PID 4196 `/usr/bin/apt-get update` ← google_osconfig, cgroup `/system.slice/google-osconfig-agent.service`. So a CI `apt-get` step can hit "Could not get lock /var/lib/apt/lists/lock" even on a hardened image; the safe resilience is a bounded retry of `apt-get update` (native locking arbitrates), or disabling/masking the OS Config agent on build images.
