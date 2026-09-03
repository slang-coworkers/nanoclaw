# repoint.md — Half B network re-point (slang-coworkers-prod host move)

A NEW Brev box = a NEW workspace id = **new public hostnames**. Files + state are moved by
`restore-state.sh`; this is the part that isn't files. Do it AFTER Half B services are up and
green. Until every ✅ below is checked, GitHub events do not arrive and cross-instance routing
dead-ends. Keep the OLD box **stopped-but-alive** as rollback.

Fill in once: `NEW_ID = <new brev workspace id>` → new hostnames
`webhook-<NEW_ID>.brevlab.com` (webhook :3841) and `3737-<NEW_ID>.brevlab.com` (dashboard).

---

## 1. Cloudflare tunnel (the inbound path) — Brev-managed
The `cloudflared.service` config is tied to the OLD workspace id; the tunnel token does not
move. The NEW box gets its OWN Brev-provisioned tunnel + hostnames.
- [ ] Confirm `systemctl status cloudflared` is active on the NEW box (Brev sets this up).
- [ ] Note the NEW public hostnames Brev assigned (`webhook-<NEW_ID>`, `3737-<NEW_ID>`, any `viewer-`).
- Signatures when probing an ingress URL: `server: envoy` + `x-pomerium-intercepted-response` + **403** = your source IP isn't in the rule's allowlist; **302 → auth.apps.run.brev.nvidia.com** = email-gated. A 403 here is the INGRESS, never the app (the app returns 200 on GET).

## 2. GitHub App webhook URL (App id 3311378) — THE critical one
Until this points at the NEW box, **zero** webhooks arrive (issues, PRs, reviews).
- [ ] In the GitHub App settings (id **3311378**) → Webhook URL → set to the NEW webhook URL
      (`https://webhook-<NEW_ID>.brevlab.com/webhook/github`). `GITHUB_WEBHOOK_SECRET` is unchanged (HMAC).
- [ ] Also update any repo/org-level webhooks (shader-slang/slang, slangpy) if they post directly.
- [ ] Non-destructive reachability probe (bad signature ⇒ 401 = reached the handler):
      `curl -s -o /dev/null -w '%{http_code}\n' -H 'X-GitHub-Event: ping' -H 'User-Agent: curl/8' -d '{}' https://webhook-<NEW_ID>.brevlab.com/webhook/github` → expect **401** (invalid signature), NOT 000/302.
- [ ] **Redeliver the gap:** mint an App JWT (RS256, iss=3311378, from `~/.config/nanoclaw/github-app.pem`),
      page `GET /app/hook/deliveries`, and `POST /app/hook/deliveries/{id}/attempts` for any that failed during the cutover window (nanoclaw dedups by GUID, so redelivery is safe).

## 3. Pomerium / Brev ingress allowlists
Each hostname → port + auth mode. If team members hit 403 (envoy), their VPN egress IP isn't
allowlisted. **NVIDIA VPN egress = Palo Alto Prisma Access — IPs are NOT NVIDIA-owned**; allowlist
the WHOLE region's prefixes (Trinity corp-ip API / Nautobot), and always drop `0.0.0.0/0`.
- [ ] Dashboard `3737-<NEW_ID>` → port 3737 ; read-only `viewer-<NEW_ID>` → 3739 ; webhook `webhook-<NEW_ID>` → 3841 (Public).
- [ ] Re-apply the India+corp allowlist set from the old box's viewer rule (hard-reload/incognito after edits — browsers cache the 403).

## 4. .env re-point (edit the restored .env on the NEW box)
- [ ] `INSTANCE_FORWARD_TARGETS` — currently `lego=https://webhook-xrnpj0b3n.apps.run.brev.nvidia.com/webhook/github`.
      lego does NOT move → keep as-is (still valid) OR drop if lego is retired.
- [ ] `INSTANCE_SLUG=prod`, ports, `CONTAINER_IMAGE=nanoclaw-agent:prod` — unchanged (path/slug identical).
- [ ] **Cost:** the 1-hour prompt-cache TTL (`ENABLE_PROMPT_CACHING_1H`, `ENABLE_PROMPT_CACHING_1H_BEDROCK`) is forced to `0` by `restore-state.sh` (`PROMPT_CACHE_1H=0` default — 1h caches cost more to write). Run restore with `PROMPT_CACHE_1H=1`, or edit `.env`, to re-enable.
- [ ] Restart the host after any .env edit: `systemctl --user restart nanoclaw.service` (or `nanoclaw-v2-<slug>`).

## 5. LEGO → NEW-prod cross-instance links (lego stays on its box; update lego)
Both hardcode prod's OLD hostname and break at the move. On **lego** (`slang-cpu-coworkers`):
- [ ] PR-mapping register: lego `.env` `INTERNAL_REGISTER_URL` → `https://webhook-<NEW_ID>.brevlab.com/internal/register-pr` (HMAC `INTERNAL_REGISTER_SECRET`, shared). Restart lego host. Probe: bad-sig POST → `401 {"error":"invalid signature"}` = reachable.
- [ ] Handoff chat bridge: lego `groups/orchestrator/sprint-triage/send.py` `BRIDGE` → `https://3737-<NEW_ID>.brevlab.com/api/chat/send` (send a `User-Agent`; empty body → 400 = reachable). send.py is bind-mounted → live, no restart.

## 6. Discord — no URL to re-point
Bot token moves with `.env`; the gateway reconnects on first use (outbound, not a webhook). Just confirm the bot shows online after the host starts.

---

## Final acceptance (parity vs the OLD box)
- [ ] A real GitHub event on a watched repo lands (check `logs/nanoclaw.log` for `delivered to …` with the GUID).
- [ ] Dashboard parity: coworkers / sessions / tasks counts match the OLD box.
- [ ] From a coworker container: net-zero git push to shader-slang/slang (a `fix/*` branch) + slang-coworkers/slang + a submodule `ls-remote` all succeed (proves OneCLI creds + tenant `172.17.0.1`).
- [ ] Only after parity: delete/retire the OLD box.
