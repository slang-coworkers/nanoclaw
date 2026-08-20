---
type: reference
title: "How to list prod→lego forwarded GitHub issues/comments over a time window (the dev-routed log line)"
description: "ported lego-operator-memory archive; reference note"
tags: [legoop-archive, ported]
---

# How to list prod→lego forwarded GitHub issues/comments over a time window (the dev-routed log line)

To list prod→lego forwarded GitHub events (issue opens + issue comments), grep prod's host log for the `dev-routed ... to peer="lego"` line — this is the clean source of truth for what actually crossed the boundary. Do NOT scan lego's session DBs for this: they're flooded with internal a2a `Holding.`/`(idle)` echoes (rows carrying `_a2a_source_thread`), which drown the real forwards. See [[project_prod_lego_routing_split]].

**Prod log:** `/home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.log` (prod = `nanoclaw.service`, workdir `/home/ubuntu/slang-coworkers-prod/nanoclaw`). The matching delivery confirmation is `webhook-forward: delivered to peer ... http://127.0.0.1:3843/webhook/github`. Lego's webhook receiver is port 3843 — see [[project_lego_repo_webhook]].

One-liner (parses type/repo/issue; log timestamps are HH:MM only with no date, so it segments by time-rollover — last `day` group ≈ today):

```bash
cd /home/ubuntu/slang-coworkers-prod/nanoclaw
grep -a "dev-routed" logs/nanoclaw.log | sed -r 's/\x1b\[[0-9;]*m//g' | \
  sed -r 's/^\[([0-9:.]+)\].*dev-routed (issue comment|issue) to peer.*repo="([^"]+)".*issue=([0-9]+).*/\1|\2|\3#\4/' | \
  awk -F'|' '{ t=$1; sub(/\..*/,"",t); gsub(":","",t); tn=t+0; if (tn<prev) day++; prev=tn; print day"|"$0 }'
```

Caveats: timestamps have no date (segment by rollover, or cross-check against `date -u` + log mtime to pin the 24h window). `issue` = open, `issue comment` = comment. Filter test-org/* rows (synthetic). To confirm lego received each, grep lego's `logs/nanoclaw.log` inbound side at `/home/ubuntu/haaggarwal/lego-nanoclaw/logs/nanoclaw.log`.

