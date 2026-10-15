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

## v2 — body usage tap (`gateway-body-usage-tap.patch`, applies ON TOP of the header patch)

**Why.** The header capture alone does NOT measure coworker cost: for **streamed** responses
(`text/event-stream` — i.e. ~all Claude Agent-SDK and Codex traffic) litellm's
`x-litellm-response-cost-original` is `0.0` (Anthropic) or a tiny prompt-only partial (OpenAI
`/v1/responses`), because HTTP headers are emitted before the completion exists. Verified on prod
2026-09-03 with an 8-probe matrix (haiku / sonnet-5 / bedrock-opus-4-8 / gpt-5.6-sol × stream on/off):
non-streamed rows carry the real cost, streamed rows carry `0.0` while `x-litellm-key-spend` climbs.
The token usage IS in the body — in the final SSE event(s).

**What it does.** `apps/gateway/src/gateway/usage_tap.rs` (new, shared) + `hooks.rs`: the response body
stream is wrapped in a pass-through that *observes* each chunk (bytes forwarded unchanged, never buffered
whole, never delayed), keeps only a small typed usage snapshot, and emits the telemetry event once the
body has ended (or the client disconnected), so the end-of-stream usage lands in `extra_data`.
`telemetry.rs`: `update_batch` (approved requests) now MERGES captured data instead of dropping it.

Recognised: Anthropic Messages (`message_start` → final `message_delta`, and non-streamed JSON),
OpenAI Responses (`response.completed|incomplete|failed`, and JSON), OpenAI Chat Completions
(`chat.completion[.chunk]`). Compressed bodies are not decompressed (`unavailable-compressed`);
oversize / malformed bodies degrade to `unavailable-oversize` / `unavailable-parse`. No pricing in Rust —
raw counts only; NanoClaw prices them with its date-aware, ccusage-parity-validated table.

**Opt-in.** `ONECLI_CAPTURE_BODY_USAGE_HOSTS=inference-api.nvidia.com` (comma-separated hosts, with or
without `:port`, or `*`). Unset = the header-only behaviour above.

**Keys written to `request_logs.extra_data` (flat, beside the captured headers):**

| key | meaning |
|---|---|
| `usage_source` | `sse` \| `json` \| `none` \| `unavailable-compressed` \| `unavailable-oversize` \| `unavailable-parse` \| `unsupported-content-type` |
| `usage_api` | `anthropic_messages_v1` \| `openai_responses_v1` \| `openai_chat_completions_v1` |
| `usage_model` | model id reported IN the body (keep litellm's `x-litellm-model-id` header separate) |
| `usage_input_tokens`, `usage_output_tokens` | **OpenAI input INCLUDES cached tokens; Anthropic input EXCLUDES cache read/creation** |
| `usage_cache_read_input_tokens` | Anthropic `cache_read_input_tokens` / OpenAI `cached_tokens` |
| `usage_cache_creation_input_tokens` | Anthropic aggregate; `usage_cache_creation_{5m,1h}_input_tokens` are its breakdown (never sum both) |
| `usage_reasoning_output_tokens`, `usage_total_tokens` | OpenAI |
| `usage_complete` | a terminal usage event was seen (false = client disconnected mid-stream) |
| `usage_body_ms`, `usage_observed_at_ms`, `usage_parse_errors` | diagnostics |

**Build (both patches, in order):**

```bash
git clone --depth 1 --branch v1.41.0 https://github.com/onecli/onecli onecli-src && cd onecli-src
git apply /path/to/gateway-response-header-capture.patch
git apply /path/to/gateway-body-usage-tap.patch
docker build -f docker/Dockerfile -t onecli-cost:latest .
```

**Verify (streamed rows must now carry usage):**

```sql
SELECT extra_data->>'usage_source' src, count(*),
       sum((extra_data->>'usage_input_tokens')::bigint) input_tok,
       sum((extra_data->>'usage_output_tokens')::bigint) output_tok
FROM request_logs
WHERE host LIKE 'inference-api.nvidia.com%' AND created_at > now() - interval '1 hour'
GROUP BY 1;
```

Downstream precedence: body usage → priced cost (NanoClaw table); non-streamed header cost = comparison
only; streamed header cost = informational; no usage → **UNKNOWN, never 0**.

## v1.42.0 re-cut (2026-10-14): `*-v1.42.0.patch`

NanoClaw 2026.10.0 asks OneCLI installs to run gateway **1.42.0** (closes the credential-injection
host-enforcement bypass, onecli/onecli#438). 1.42.0 also replaces the policy engine with a unified
first-match engine plus an automatic migration (#436), so the upgrade is a behaviour change for
credential matching, not only a security patch; verify injection after the swap (below).

The two v1.41.0 patches do not apply to v1.42.0: every `RequestEvent` literal gained a
`matched_rule` field exactly where the header patch adds `captured_headers`, and
`telemetry_core.rs` gained the matching `matched_rule_logical_ids` batch column. The re-cut keeps
both fields side by side; the body-usage tap conflicted only in `hooks.rs` (same cause). Nothing
else changed, and `usage_tap.rs` is byte-identical to the v1.41.0 version.

**Build (v1.42.0):**

```bash
git clone --depth 1 --branch v1.42.0 https://github.com/onecli/onecli onecli-src && cd onecli-src
git apply /path/to/gateway-response-header-capture-v1.42.0.patch
git apply /path/to/gateway-body-usage-tap-v1.42.0.patch
docker build -f docker/Dockerfile -t onecli-cost:v3 .   # ~9 min on lego
```

**Swap (health-gated, keep the old compose file as rollback):**

```bash
cp -p docker-compose.yml docker-compose.yml.bak-pre-v3
sed -i 's|image: onecli-cost:v2|image: onecli-cost:v3|' docker-compose.yml
docker compose up -d onecli            # Prisma applies the 1.42.0 migrations on first start
# wait for `docker inspect --format '{{.State.Health.Status}}' <container>` = healthy, then
curl -s http://127.0.0.1:<api-port>/api/health  # {"status":"ok","version":"1.42.0",...}
```

If the container does not reach `healthy`, set the image back to `onecli-cost:v2` and `up -d` again.

**Verify after the swap, from inside a coworker container** (the policy migration must not have
changed what gets injected):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'User-Agent: curl/8' https://api.github.com/repos/<org>/<repo>      # 200
curl -s -o /dev/null -w '%{http_code}\n' 'https://github.com/<org>/<repo>.git/info/refs?service=git-receive-pack' # 200 = push token injected
```

then one non-streamed inference call and the `request_logs` row for its `x-litellm-call-id` must
carry `usage_source` = `json` with the token counts.

**Verified on lego 2026-10-14:** health `1.42.0` after 10 s; 82 Prisma migrations applied; GitHub
API and push-probe 200 from a coworker container; oracle call `7bc32ef2-…` captured with
`usage_input_tokens: 14`, `usage_output_tokens: 4`, cost header `0.000136`; `ncl cost-cap coworkers`
unchanged. Prod (`onecli-cost:v2`, 1.41.0) not yet swapped.
