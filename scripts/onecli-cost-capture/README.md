# onecli-cost-capture

A small, generic patch to the **OneCLI** gateway (`onecli/onecli` **v1.41.0**, Rust) that records
allowlisted **response headers** into the `request_logs.extra_data` column. Its purpose here: capture
the inference gateway's (litellm) **exact per-request cost** (`X-Litellm-Response-Cost-Original`) beside
the `agent_id` OneCLI already logs — so **cost-per-coworker becomes a SQL query**, no token estimation.

Verified on lego 2026-09-01: real haiku call → `request_logs.extra_data` cost **== litellm's own header,
to the digit**, matched by `x-litellm-call-id`; inference unaffected.

## What it changes (~57 LOC, generic — not litellm-specific)

- `apps/gateway/src/telemetry_core.rs` — `RequestEvent.captured_headers: String` + `BatchColumns.extra_datas` + `extract_columns`.
- `apps/gateway/src/telemetry.rs` — the batch `INSERT` now writes `extra_data` (aliased `UNNEST` + `NULLIF(extra,'')::jsonb`).
- `apps/gateway/src/gateway/hooks.rs` — `track_and_wrap` reads an env-driven header allowlist from the (previously unused) `resp_headers` into `extra_data`.
- `apps/gateway/src/gateway/{forward,websocket}.rs` — the other emit sites set the new field to `""`.

The capture is **opt-in** via `ONECLI_CAPTURE_RESPONSE_HEADERS` (comma-separated header names). **Unset = byte-identical stock behavior** (no-op). It rides OneCLI's **async telemetry batch**, so the credential-injection request path is untouched — worst case is a dropped log row, never an outage.

## Build

```bash
git clone --depth 1 --branch v1.41.0 https://github.com/onecli/onecli onecli-src
cd onecli-src
git apply /path/to/gateway-response-header-capture.patch
docker build -f docker/Dockerfile -t onecli-cost:latest .   # Rust build; ~10-15 min
```

## Deploy (behind the flag)

Point the OneCLI compose `onecli` service at `image: onecli-cost:latest` and add:

```yaml
    environment:
      ONECLI_CAPTURE_RESPONSE_HEADERS: x-litellm-response-cost-original,x-litellm-call-id,x-litellm-model-id,x-litellm-key-spend
```

Then `docker compose up -d onecli`. **Health-check + auto-rollback recommended** (verify the container is Up + the API answers 200, else restore the stock image).

## Verify (oracle match)

```sql
-- captured per-request cost, attributed to the coworker (agent_id)
SELECT agent_id, extra_data->>'x-litellm-response-cost-original' AS cost
FROM request_logs WHERE extra_data ? 'x-litellm-response-cost-original'
ORDER BY created_at DESC LIMIT 10;

-- cost-per-coworker rollup (the payoff)
SELECT agent_id, count(*), sum((extra_data->>'x-litellm-response-cost-original')::numeric) AS cost_usd
FROM request_logs WHERE extra_data ? 'x-litellm-response-cost-original'
GROUP BY agent_id ORDER BY cost_usd DESC;
```

To confirm correctness, make a call with `curl -i` from inside a coworker container, read the
`X-Litellm-Response-Cost-Original` + `X-Litellm-Call-Id` response headers (the oracle), then check the
`request_logs` row for that `call-id` carries the same cost.

## Upstream

The change is a generic "capture response headers into request_logs" feature — a clean PR candidate for
`onecli/onecli` (not litellm- or NanoClaw-specific). Keep this patch pinned to the OneCLI version it was
cut against (`v1.41.0`); re-cut on upgrade.
