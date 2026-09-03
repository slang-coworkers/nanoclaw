#!/usr/bin/env bash
# Run the read-only NanoClaw collector and push its line protocol to InfluxDB.
#
# This is the wrapper the systemd unit (nanoclaw-metrics.service) calls every
# 60s. It was NOT committed with the rest of the stack in #1187 (only the .py,
# the .service and the dashboard were) and so lived only on the prod box until
# it was reconstructed here 2026-08-31 during the AWS host-move. Keep it in git.
#
# Config comes from /etc/nanoclaw-metrics.env (EnvironmentFile in the unit).
# See nanoclaw-metrics.env.example for the shape. InfluxDB is 1.x-compat,
# db=lp (NOT "nanoclaw" — see ops/README.md).
set -uo pipefail

: "${INFLUX_URL:=http://127.0.0.1:8086}"
: "${INFLUX_DB:=lp}"
: "${INFLUX_ORG:=lp}"
: "${INFLUX_BUCKET:=lp}"
: "${INFLUX_TOKEN:=}"
: "${INFLUX_USER:=}"
: "${INFLUX_PASS:=}"
: "${COLLECTOR:=/usr/local/bin/nanoclaw-metrics.py}"

lp="$(python3 "$COLLECTOR" 2>/tmp/nanoclaw-metrics.collector.err)"
rc=$?
if [ $rc -ne 0 ] || [ -z "$lp" ]; then
  echo "nanoclaw-metrics: collector failed rc=$rc / empty output; stderr:" >&2
  cat /tmp/nanoclaw-metrics.collector.err >&2 2>/dev/null || true
  exit 1
fi

# The collector emits points WITHOUT timestamps on purpose, so InfluxDB stamps
# each with server-receipt time. Fail loudly on a non-2xx so the timer's
# journal shows a real write failure instead of silently going stale.
#
# InfluxDB here is 2.x. The v1 user/password (INFLUX_USER) is READ-only (it is
# what Grafana queries with), so a v1 /write?db= POST returns 403. Writing needs
# the v2 token via /api/v2/write -- the same token telegraf writes with. Prefer
# the token; fall back to the v1 endpoint only if no token is configured.
if [ -n "$INFLUX_TOKEN" ]; then
  code=$(printf '%s' "$lp" | curl -s -o /tmp/nanoclaw-metrics.write.out -w '%{http_code}' \
    --max-time 15 \
    -H "Authorization: Token $INFLUX_TOKEN" \
    --data-binary @- \
    "$INFLUX_URL/api/v2/write?org=$INFLUX_ORG&bucket=$INFLUX_BUCKET&precision=ns")
else
  code=$(printf '%s' "$lp" | curl -s -o /tmp/nanoclaw-metrics.write.out -w '%{http_code}' \
    --max-time 15 \
    ${INFLUX_USER:+-u} ${INFLUX_USER:+"$INFLUX_USER:$INFLUX_PASS"} \
    --data-binary @- \
    "$INFLUX_URL/write?db=$INFLUX_DB")
fi

case "$code" in
  204|200) exit 0 ;;
  *)
    echo "nanoclaw-metrics: influx write HTTP $code" >&2
    head -c 400 /tmp/nanoclaw-metrics.write.out >&2 2>/dev/null || true
    exit 1
    ;;
esac
