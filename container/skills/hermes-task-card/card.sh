#!/usr/bin/env bash
# card.sh -- render one 900x600 task card (JSON + HTML + PNG) for a finished role task.
#
#   card.sh render <payload.json> [--thread <id>] [--out-dir <dir>]
#   card.sh selftest
#
# Exit codes: 0 ok (PNG exists, > 8 KB, IHDR 900x600) / 1 payload invalid /
# 2 no thread id (neither --thread nor $NANOCLAW_SESSION_THREAD_ID) / 3 PNG failed
# (HTML + JSON were still written -- send the .html with the "card(html) · " caption).
#
# The screenshot never touches file://: the out-dir is served by a loopback
# python http.server on a free port and agent-browser opens http://127.0.0.1:<port>/.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER="$SKILL_DIR/render_card.py"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit "${1:-2}"
}

have() { command -v "$1" >/dev/null 2>&1; }

# Run agent-browser with the proxy env scrubbed and a 90 s wall clock (when
# `timeout` exists -- coreutils in the container; absent on a stock Mac).
ab() {
  # The proxy scrub is best-effort: the container env already carries NO_PROXY for loopback.
  local cmd=(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY
    no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost agent-browser "$@")
  if have timeout; then
    timeout 90 "${cmd[@]}"
  else
    "${cmd[@]}"
  fi
}

free_port() {
  python3 -c 'import socket
s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

# serve_dir <dir> -> sets SERVER_PID + PORT; waits until the server answers.
serve_dir() {
  local dir=$1
  PORT=$(free_port) || return 1
  python3 -m http.server --bind 127.0.0.1 "$PORT" --directory "$dir" >/dev/null 2>&1 &
  SERVER_PID=$!
  local i
  for i in $(seq 1 50); do
    if env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY python3 -c "
import sys, urllib.request
urllib.request.urlopen('http://127.0.0.1:$PORT/', timeout=1).read(64)" >/dev/null 2>&1; then
      return 0
    fi
    kill -0 "$SERVER_PID" 2>/dev/null || { echo "card.sh: http.server exited early" >&2; return 1; }
    sleep 0.1
  done
  echo "card.sh: http.server on 127.0.0.1:$PORT never answered" >&2
  return 1
}

# screenshot <out-dir> <html-basename> <png-path> -> 0 on a verified PNG, else 3.
screenshot() {
  local dir=$1 html=$2 png=$3 errlog
  errlog=$(mktemp "${TMPDIR:-/tmp}/card-ab.XXXXXX")
  rm -f "$png"
  if ! have agent-browser; then
    echo "card.sh: agent-browser not on PATH; PNG skipped, HTML is at $dir/$html" >&2
    rm -f "$errlog"
    return 3
  fi
  if ! serve_dir "$dir"; then
    rm -f "$errlog"
    return 3
  fi
  local ok=0
  {
    ab open "http://127.0.0.1:$PORT/$html" &&
    ab set viewport 900 600 1 &&
    ab wait --load networkidle &&
    ab screenshot "$png"
  } 2>>"$errlog" >>"$errlog" && ok=1
  ab close >>"$errlog" 2>&1 || true
  cleanup
  if [ "$ok" -ne 1 ]; then
    echo "card.sh: agent-browser failed; stderr follows" >&2
    cat "$errlog" >&2
    rm -f "$errlog"
    return 3
  fi
  if ! python3 "$RENDER" check-png "$png"; then
    echo "card.sh: screenshot written but failed the PNG check; agent-browser output follows" >&2
    cat "$errlog" >&2
    rm -f "$errlog"
    return 3
  fi
  rm -f "$errlog"
  return 0
}

cmd_render() {
  local payload="" thread="${NANOCLAW_SESSION_THREAD_ID:-}" out_dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --thread) thread="${2:-}"; shift 2 ;;
      --thread=*) thread="${1#--thread=}"; shift ;;
      --out-dir) out_dir="${2:-}"; shift 2 ;;
      --out-dir=*) out_dir="${1#--out-dir=}"; shift ;;
      -h|--help) usage 0 ;;
      -*) echo "card.sh: unknown flag $1" >&2; usage 2 ;;
      *) if [ -z "$payload" ]; then payload=$1; else echo "card.sh: unexpected arg $1" >&2; usage 2; fi; shift ;;
    esac
  done
  [ -n "$payload" ] || { echo "card.sh: render needs <payload.json>" >&2; usage 2; }
  [ -f "$payload" ] || { echo "card.sh: payload not found: $payload" >&2; exit 1; }
  if [ -z "$thread" ]; then
    echo "card.sh: no thread id -- pass --thread <id> or set NANOCLAW_SESSION_THREAD_ID" >&2
    exit 2
  fi
  [ -n "$out_dir" ] || out_dir="/workspace/agent/reports/$thread/cards"
  mkdir -p "$out_dir" || exit 1

  local lines stem role
  lines=$(python3 "$RENDER" render "$payload" --thread "$thread" --out-dir "$out_dir") || exit 1
  stem=$(printf '%s\n' "$lines" | sed -n 1p)
  role=$(printf '%s\n' "$lines" | sed -n 2p)
  local html="$out_dir/$stem.html" png="$out_dir/$stem.png"
  cp "$html" "$out_dir/card-$role-latest.html"
  echo "card.sh: wrote $out_dir/$stem.json"
  echo "card.sh: wrote $html"

  if screenshot "$out_dir" "$stem.html" "$png"; then
    cp "$png" "$out_dir/card-$role-latest.png"
    echo "card.sh: wrote $png"
    echo "PNG=$png"
    echo "HTML=$html"
    return 0
  fi
  echo "card.sh: PNG FAILED (exit 3); fall back to sending the HTML: $html" >&2
  echo "HTML=$html"
  return 3
}

cmd_selftest() {
  local tmp example rc
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/card-selftest.XXXXXX")
  example="$SKILL_DIR/examples/tester-fail.json"
  echo "selftest: out-dir $tmp"

  # 1. thread-id refusal (exit 2) -- must not even create files.
  ( unset NANOCLAW_SESSION_THREAD_ID; bash "$0" render "$example" --out-dir "$tmp/none" ) >/dev/null 2>&1
  rc=$?
  [ "$rc" -eq 2 ] || { echo "selftest: expected exit 2 without a thread id, got $rc" >&2; exit 1; }
  [ ! -e "$tmp/none" ] || { echo "selftest: out-dir created despite missing thread id" >&2; exit 1; }
  echo "selftest: missing thread id -> exit 2  ok"

  # 2. validation refusal (exit 1) -- a tester cannot report APPROVE.
  printf '{"row":"X-1","role":"hermes-tester","outcome":"APPROVE"}\n' > "$tmp/bad.json"
  bash "$0" render "$tmp/bad.json" --thread hermes-SELFTEST --out-dir "$tmp/bad" >/dev/null 2>&1
  rc=$?
  [ "$rc" -eq 1 ] || { echo "selftest: expected exit 1 for a bad outcome, got $rc" >&2; exit 1; }
  echo "selftest: invalid outcome -> exit 1  ok"

  # 3. JSON + HTML from the example payload (renderer only, no browser).
  local lines stem
  lines=$(python3 "$RENDER" render "$example" --thread hermes-SELFTEST --out-dir "$tmp/cards") || exit 1
  stem=$(printf '%s\n' "$lines" | sed -n 1p)
  [ "$stem" = "card-hermes-tester-fail-r2" ] || { echo "selftest: unexpected stem $stem" >&2; exit 1; }
  [ -s "$tmp/cards/$stem.json" ] && [ -s "$tmp/cards/$stem.html" ] || { echo "selftest: json/html missing" >&2; exit 1; }
  grep -q 'width:900px;height:600px;overflow:hidden' "$tmp/cards/$stem.html" || { echo "selftest: 900x600 CSS missing" >&2; exit 1; }
  grep -q 'class="badge bad">FAIL<' "$tmp/cards/$stem.html" || { echo "selftest: verdict badge missing" >&2; exit 1; }
  echo "selftest: json + html rendered ($stem)  ok"

  # 4. PNG checker: rejects the HTML file, accepts a synthetic 900x600 PNG.
  if python3 "$RENDER" check-png "$tmp/cards/$stem.html" 2>/dev/null; then
    echo "selftest: check-png accepted an HTML file" >&2; exit 1
  fi
  python3 "$RENDER" fake-png "$tmp/cards/synthetic.png" || exit 1
  python3 "$RENDER" check-png "$tmp/cards/synthetic.png" 2>/dev/null || { echo "selftest: check-png rejected the synthetic 900x600 PNG" >&2; exit 1; }
  echo "selftest: png checker (reject html, accept synthetic 900x600)  ok"

  # 5. Full pipeline through card.sh render. With chromium + agent-browser present
  #    the PNG is real and must pass; without them exit 3 (HTML fallback) is the
  #    expected, documented outcome on a laptop.
  local chromium="${AGENT_BROWSER_EXECUTABLE_PATH:-/usr/bin/chromium}"
  if have agent-browser && [ -x "$chromium" ]; then
    bash "$0" render "$example" --thread hermes-SELFTEST --out-dir "$tmp/full" || { echo "selftest: full render failed" >&2; exit 1; }
    [ -s "$tmp/full/card-hermes-tester-latest.png" ] || { echo "selftest: latest.png missing" >&2; exit 1; }
    echo "selftest: real screenshot via agent-browser  ok"
  else
    bash "$0" render "$example" --thread hermes-SELFTEST --out-dir "$tmp/full" >/dev/null 2>&1
    rc=$?
    [ "$rc" -eq 3 ] || { echo "selftest: expected exit 3 without a browser, got $rc" >&2; exit 1; }
    [ -s "$tmp/full/card-hermes-tester-latest.html" ] || { echo "selftest: latest.html missing on fallback" >&2; exit 1; }
    echo "selftest: no chromium/agent-browser here -> exit 3 with HTML fallback  ok (PNG path not exercised)"
  fi

  rm -rf "$tmp"
  echo "selftest: PASS"
  return 0
}

case "${1:-}" in
  render) shift; cmd_render "$@" ;;
  selftest) shift; cmd_selftest "$@" ;;
  -h|--help|help) usage 0 ;;
  *) usage 2 ;;
esac
