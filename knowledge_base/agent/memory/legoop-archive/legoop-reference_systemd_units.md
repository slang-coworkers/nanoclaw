---
type: reference
title: "systemd units on this host — which one is prod"
description: "ported lego-operator-memory archive; reference note"
tags: [legoop-archive, ported]
---

# systemd units on this host — which one is prod

On this host, the prod service (`/home/ubuntu/slang-coworkers-prod/nanoclaw`) is the unit **`nanoclaw.service`** ("NanoClaw (slang-coworkers-prod)"). Other checkouts (lego dev, per-engineer instances) run as separately-named units (`nanoclaw-haaggarwal-lego.service`, `nanoclaw-<user>.service`).

**Why it matters:** if you build `dist/` in the prod checkout and restart the wrong unit, your code change never loads. Always `systemctl --user restart nanoclaw` for prod, and verify with `systemctl --user show nanoclaw -p MainPID` / `ps -ef | grep dist/index.js` that the new PID's working dir matches where you built.

Related: every restart kills running agent containers (initGroupFilesystem → CLAUDE.md recompose → claude-md-stale kill), so batch fixes and prefer a dashboard-only / per-group restart when possible.
