---
title: "Auditing missed webhooks after downtime — use the App delivery log (JWT), filter by ownership"
type: learning
topic: agent-ops
source: learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md
---

# Auditing missed webhooks after downtime — use the App delivery log (JWT), filter by ownership

When prod is down (update/restart), GitHub webhook deliveries fail (502) and are lost unless redelivered. To audit precisely:

## Get the failures (authoritative source)
The App webhook delivery log needs an **app JWT** (App ID 3311378 + `~/.config/nanoclaw/github-app.pem`), not an installation token. Mint inline:
```
JWT=$(python3 -c "import jwt,time;k=open('/home/ubuntu/.config/nanoclaw/github-app.pem').read();n=int(time.time());print(jwt.encode({'iat':n-60,'exp':n+600,'iss':'3311378'},k,algorithm='RS256'))")
curl -H "Authorization: Bearer $JWT" "https://api.github.com/app/hook/deliveries?per_page=100"
```
- The list is cursor-paginated (`Link: rel=next` → `&cursor=...`); 100/page ≈ 40 min of history, so page back to the downtime window.
- Single-delivery GET (`/app/hook/deliveries/{id}`) needs the **integer `id`**, NOT the `guid` (else 422 "delivery_id must be an integer"). Redeliver via `POST /app/hook/deliveries/{id}/attempts`.

## Filter by ownership before redelivering — most "lost" webhooks don't matter
A lost webhook only matters if its PR/issue is **mapped to a prod session** (`pr_session_mappings WHERE owner_instance='prod'`). Events for unmapped PRs hit `deliverMappedPrEvent` → no mapping → **dropped by design** anyway; redelivering them re-drops. Resolve each failed delivery's PR number from its payload, check the mapping, and only redeliver prod-owned ones.

## Incident 2026-06-06 (the /update restart)
Service down 04:14:28–04:18:58 UTC → 23 deliveries 502'd (reviews/comments/CI for #11436 + #11437). **Both unmapped → none actionable.** Prod's only owned in-flight PR (#11492) was still a *draft* during the window (drafts emit no CI/CodeRabbit), so zero prod-owned events were lost. No redelivery needed.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md`_
