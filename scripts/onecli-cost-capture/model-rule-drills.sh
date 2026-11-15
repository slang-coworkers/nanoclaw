#!/usr/bin/env bash
# Bypass drills for the open-models-only rules (docs/session-privilege.md), run on a throwaway gateway.
#
# It starts the gateway image beside the live OneCLI, with its own database and ports, makes an agent
# with the three rules the spawn writes and an agent with none, and sends each attempt through the
# proxy. A row says BLOCK when the gateway refuses the request and PASS when it reaches the upstream.
# Rows that end in MISMATCH are the findings. Only codes and short body heads are printed, never tokens.
#
# Environment: IMG (gateway image, default onecli-cost:v5), DRILL_HOST_GLOB (hostname guard),
# DRILL_DIR (log directory), PG (postgres container), NET (compose network), LIVE (live gateway container).
# The defaults fit the lego box.
case "$(hostname)" in ${DRILL_HOST_GLOB:-slang-cpu-coworkers-inst-*}) ;; *) echo WRONGHOST; exit 1;; esac
IMG=${IMG:-onecli-cost:v5}
DIR=${DRILL_DIR:-/tmp/lego-audit/onecli-model}; mkdir -p "$DIR"; OUT=$DIR/drills-${IMG##*:}.log; exec > $OUT 2>&1
free=$(df --output=avail -BG / | tail -1 | tr -dc 0-9); echo "free=${free}G"; [ "$free" -ge 17 ] || { echo STOP; exit 1; }
docker exec ${PG:-onecli-lego-postgres-1} sh -c 'psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS onecli_v4test" -c "CREATE DATABASE onecli_v4test"' | tail -1
URL=$(docker inspect ${LIVE:-onecli-lego} --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^DATABASE_URL=//p')
URL2=$(printf '%s' "$URL" | sed -E 's#/[^/?]+(\?|$)#/onecli_v4test\1#')
docker rm -f onecli-v4-test >/dev/null 2>&1
docker run -d --name onecli-v4-test --network ${NET:-onecli-lego_default} -e DATABASE_URL="$URL2" \
  -e NEXT_PUBLIC_APP_URL=http://127.0.0.1:10356 -e APP_URL=http://127.0.0.1:10356 \
  -p 127.0.0.1:10356:10254 -p 127.0.0.1:10355:10255 ${IMG:-onecli-cost:v5} >/dev/null && echo started
for i in $(seq 1 60); do curl -sf -m 3 http://127.0.0.1:10356/v1/health >/dev/null 2>&1 && break; sleep 3; done
B=http://127.0.0.1:10356
for n in t-open t-free; do curl -s -m 15 -o /dev/null -X POST $B/api/agents -H 'Content-Type: application/json' -d "{\"name\":\"$n\",\"identifier\":\"$n\"}"; done
AG=$(curl -s -m 15 $B/api/agents)
AID=$(printf '%s' "$AG" | jq -r 'if type=="array" then . else .data end | map(select(.identifier=="t-open"))[0].id')
TOK=$(printf '%s' "$AG" | jq -r 'if type=="array" then . else .data end | map(select(.identifier=="t-open"))[0].accessToken')
FTOK=$(printf '%s' "$AG" | jq -r 'if type=="array" then . else .data end | map(select(.identifier=="t-free"))[0].accessToken')
rule(){ curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST $B/v1/policy/rules -H 'Content-Type: application/json' -d "$1"; }
GL='nvidia/*,openai/nvidia/*'
# The three rules the installer writes for an open agent, for one host.
mkrules(){ h=$1
  echo "rules $h: body=$(rule "{\"name\":\"open-models-only (t-open) $h\",\"action\":\"block\",\"enabled\":true,\"identities\":[{\"type\":\"agent\",\"id\":\"$AID\"}],\"targets\":[{\"kind\":\"network\",\"hostPattern\":\"$h\",\"method\":\"POST\"},{\"kind\":\"network\",\"hostPattern\":\"$h\",\"method\":\"PUT\"},{\"kind\":\"network\",\"hostPattern\":\"$h\",\"method\":\"PATCH\"}],\"conditions\":[{\"target\":\"body\",\"key\":\"model\",\"operator\":\"not_in\",\"value\":\"$GL\"}]}") routes=$(rule "{\"name\":\"open-models-only (t-open) $h routes\",\"action\":\"block\",\"enabled\":true,\"identities\":[{\"type\":\"agent\",\"id\":\"$AID\"}],\"targets\":[{\"kind\":\"network\",\"hostPattern\":\"$h\",\"pathPattern\":\"/model/*\"},{\"kind\":\"network\",\"hostPattern\":\"$h\",\"pathPattern\":\"/llm/*\"}]}") query=$(rule "{\"name\":\"open-models-only (t-open) $h query\",\"action\":\"block\",\"enabled\":true,\"identities\":[{\"type\":\"agent\",\"id\":\"$AID\"}],\"targets\":[{\"kind\":\"network\",\"hostPattern\":\"$h\"}],\"conditions\":[{\"target\":\"query\",\"key\":\"model\",\"operator\":\"not_in\",\"value\":\"$GL\"}]}")"; }
H='api.anthropic.com'; H2='inference-api.nvidia.com'
mkrules $H; mkrules $H2
echo "publish=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST $B/v1/policy/publish -H 'Content-Type: application/json' -d '{}')"
sleep 3
P="http://x:$TOK@127.0.0.1:10355"; PF="http://x:$FTOK@127.0.0.1:10355"
OPEN='{"model":"nvidia/zai-org/glm-5.3","max_tokens":1,"messages":[{"role":"user","content":"x"}]}'
CLOSED='aws/anthropic/bedrock-claude-opus-5-5'
# t <label> <expected: BLOCK|PASS> <curl args...>   BLOCK = the gateway refuses; PASS = the request reaches upstream.
t(){ l=$1; e=$2; shift 2
  r=$(curl -sk -m 40 -w '\n%{http_code}' -x "$P" "$@" 2>&1); c=$(printf '%s' "$r" | tail -1); b=$(printf '%s' "$r" | head -n -1 | tr -d '\n' | cut -c1-90)
  if printf '%s' "$b" | grep -q 'blocked_by_pol'; then g=BLOCK; else g=PASS; fi
  v=ok; [ "$g" = "$e" ] || v="MISMATCH(expected $e)"
  printf '%-44s %s http=%s %s | %s\n' "$l" "$g" "$c" "$v" "$b"; }
# c <label> <url...>: the agent with no rules, to see how the real upstream resolves a path. Prints the status only.
c(){ l=$1; shift; printf '%-44s upstream http=%s\n' "$l" "$(curl -sk -m 40 -o /dev/null -w '%{http_code}' -x "$PF" --path-as-is "$@")"; }
U=https://$H/v1/messages; J='content-type: application/json'
t "01 open model (control)"                 PASS  -X POST $U -H "$J" -d "$OPEN"
t "02 closed model (control)"               BLOCK -X POST $U -H "$J" -d "{\"model\":\"$CLOSED\",\"max_tokens\":1}"
t "03 nested model only"                    BLOCK -X POST $U -H "$J" -d "{\"x\":{\"model\":\"$CLOSED\"}}"
t "04 duplicate key, open first"            BLOCK -X POST $U -H "$J" -d "{\"model\":\"nvidia/a\",\"model\":\"$CLOSED\"}"
t "05 duplicate key, closed first"          BLOCK -X POST $U -H "$J" -d "{\"model\":\"$CLOSED\",\"model\":\"nvidia/a\"}"
t "06 escaped duplicate (mod\\u0065l)"      BLOCK -X POST $U -H "$J" -d "{\"model\":\"nvidia/a\",\"mod\\u0065l\":\"$CLOSED\"}"
t "07 case variant Model + open model"      BLOCK -X POST $U -H "$J" -d "{\"model\":\"nvidia/a\",\"Model\":\"$CLOSED\"}"
t "08 array body"                           BLOCK -X POST $U -H "$J" -d "[{\"model\":\"$CLOSED\"}]"
t "09 model is an array"                    BLOCK -X POST $U -H "$J" -d "{\"model\":[\"$CLOSED\"]}"
t "10 model is a number"                    BLOCK -X POST $U -H "$J" -d '{"model":1}'
t "11 gzip body, open model"                BLOCK -X POST $U -H "$J" -H 'content-encoding: gzip' --data-binary @<(printf '%s' "$OPEN" | gzip)
t "12 chunked body, open model (fail closed)" BLOCK -X POST $U -H "$J" -H 'transfer-encoding: chunked' -d "$OPEN"
t "13 chunked body, closed model"           BLOCK -X POST $U -H "$J" -H 'transfer-encoding: chunked' -d "{\"model\":\"$CLOSED\"}"
t "14 text/plain, closed model"             BLOCK -X POST $U -H 'content-type: text/plain' -d "{\"model\":\"$CLOSED\"}"
t "15 no content-type, closed model"        BLOCK -X POST $U -d "{\"model\":\"$CLOSED\"}"
t "16 BOM before JSON, open model"          BLOCK -X POST $U -H "$J" --data-binary @<(printf '\xef\xbb\xbf%s' "$OPEN")
t "17 leading space model value"            BLOCK -X POST $U -H "$J" -d "{\"model\":\" nvidia/a\"}"
t "18 upper-case NVIDIA/ prefix"            BLOCK -X POST $U -H "$J" -d '{"model":"NVIDIA/a"}'
t "19 PUT closed model"                     BLOCK -X PUT  $U -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "20 PATCH closed model"                   BLOCK -X PATCH $U -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "21 other path, closed model"             BLOCK -X POST https://$H/v1/chat/completions -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "22 double slash path"                    BLOCK -X POST "https://$H//v1/messages" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "23 query string"                         BLOCK -X POST "$U?x=1" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "24 host with trailing dot"               BLOCK -X POST "https://$H./v1/messages" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "25 host with :443"                       BLOCK -X POST "https://$H:443/v1/messages" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "26 host upper case"                      BLOCK -X POST "https://API.ANTHROPIC.COM/v1/messages" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "27 Host header differs from CONNECT"     BLOCK -X POST $U -H "$J" -H 'Host: example.org' -d "{\"model\":\"$CLOSED\"}"
t "28 /model/ route, GET"                   BLOCK -X GET  "https://$H/model/info"
t "29 /llm/ route, GET"                     BLOCK -X GET  "https://$H/llm/x"
t "30 dot segments, path as is"            BLOCK -X GET --path-as-is  "https://$H/v1/../model/info"
t "31 percent-encoded /model/"              BLOCK -X GET  "https://$H/%6dodel/info"
# Bodies of 33 MiB and more are not buffered. The rule must still refuse them.
f=$DIR/big.json; { printf '{"model":"nvidia/zai-org/glm-5.3","pad":"'; head -c 34000000 /dev/zero | tr '\0' A; printf '"}'; } > $f
t "32 34 MB body, open model"               BLOCK -X POST $U -H "$J" --data-binary @$f
{ printf '{"pad":"'; head -c 34000000 /dev/zero | tr '\0' A; printf "\",\"model\":\"$CLOSED\"}"; } > $f
t "33 34 MB body, closed model last"        BLOCK -X POST $U -H "$J" --data-binary @$f
rm -f $f
t "34 GET with body, closed model (known limit)" PASS -X GET  $U -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "35 DELETE with body (known limit)"     PASS -X DELETE $U -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "36 other host (no credential there)"    PASS -X POST https://api.openai.com/v1/chat/completions -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "37 encoded /%6Dodel/"                    BLOCK -X GET --path-as-is "https://$H/%6Dodel/info"
t "38 encoded slash /model%2Finfo"          BLOCK -X GET --path-as-is "https://$H/model%2Finfo"
t "39 dot segment /./model/"                BLOCK -X GET --path-as-is "https://$H/./model/info"
t "40 upper case /Model/ (routes are case-sensitive)" PASS -X GET --path-as-is "https://$H/Model/info"
t "41 double slash //model/"                BLOCK -X GET --path-as-is "https://$H//model/info"
t "42 encoded /%6Clm/"                      BLOCK -X GET --path-as-is "https://$H/%6Clm/x"
t "43 websocket realtime, model in query"   BLOCK -X GET "https://$H/v1/realtime?model=$CLOSED" -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='
t "44 POST /v1/responses closed model"      BLOCK -X POST "https://$H/v1/responses" -H "$J" -d "{\"model\":\"$CLOSED\"}"
t "45 query model on POST, no body"         BLOCK -X POST "https://$H/v1/messages?model=nvidia/a"
echo "--- real inference host: how LiteLLM resolves each spelling, with no rule (control agent) ---"
R=https://$H2
for sp in /model/info /%6Dodel/info /model%2Finfo //model/info /./model/info /v1/../model/info /Model/info /%256Dodel/info; do c "ctl GET $sp" -X GET "$R$sp"; done
echo "--- real inference host: the rule agent (every spelling must be refused) ---"
for sp in /model/info /%6Dodel/info /model%2Finfo //model/info /./model/info /v1/../model/info /%256Dodel/info /llm/x /%6Clm/x; do
  t "rule GET $sp" BLOCK -X GET --path-as-is "$R$sp"; done
t "rule POST //model/x/invoke"              BLOCK -X POST --path-as-is "$R//model/x/invoke" -H "$J" -d "{\"model\":\"nvidia/a\"}"
t "rule POST /model/%252e%252e/invoke"      BLOCK -X POST --path-as-is "$R/model/%252e%252e/invoke" -H "$J" -d "{\"model\":\"nvidia/a\"}"
t "rule POST /model/%2e%2e/invoke"          BLOCK -X POST --path-as-is "$R/model/%2e%2e/invoke" -H "$J" -d "{\"model\":\"nvidia/a\"}"
t "rule GET /%2e%2e/model/info"             BLOCK -X GET --path-as-is "$R/%2e%2e/model/info"
t "rule POST /model%252Finfo"               BLOCK -X POST --path-as-is "$R/model%252Finfo" -H "$J" -d "{\"model\":\"nvidia/a\"}"
t "rule GET /v1/models;model=closed (no param)" PASS -X GET --path-as-is "$R/v1/models;model=x"
t "rule WS realtime closed model"           BLOCK -X GET "$R/v1/realtime?model=$CLOSED" -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='
t "rule WS realtime open model"             PASS  -X GET "$R/v1/realtime?model=nvidia/zai-org/glm-5.3" -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='
t "rule GET /v1/models (no model param)"    PASS  -X GET "$R/v1/models"
t "rule GET closed model in query"          BLOCK -X GET "$R/v1/models?model=$CLOSED"
t "rule GET Model= in query"                BLOCK -X GET "$R/v1/models?Model=$CLOSED"
t "rule GET encoded name in query"          BLOCK -X GET "$R/v1/models?%6Dodel=$CLOSED"
t "rule GET two models in query"            BLOCK -X GET "$R/v1/models?model=nvidia/a&model=$CLOSED"
t "rule POST open body + closed query"      BLOCK -X POST "$R/v1/chat/completions?model=$CLOSED" -H "$J" -d "$OPEN"
t "rule POST open body, no query (control)" PASS  -X POST "$R/v1/chat/completions" -H "$J" -d "$OPEN"
echo "--- propagation: seconds from a publish to the gateway applying the change, for an agent that already exists ---"
curl -s -m 15 -o /dev/null -X POST $B/api/agents -H 'Content-Type: application/json' -d '{"name":"t-late","identifier":"t-late"}'
AG=$(curl -s -m 15 $B/api/agents)
LID=$(printf '%s' "$AG" | jq -r 'if type=="array" then . else .data end | map(select(.identifier=="t-late"))[0].id')
LTOK=$(printf '%s' "$AG" | jq -r 'if type=="array" then . else .data end | map(select(.identifier=="t-late"))[0].accessToken')
late(){ curl -sk -m 20 -x "http://x:$LTOK@127.0.0.1:10355" -X POST "https://$H2/v1/chat/completions" -H "$J" -d "{\"model\":\"$CLOSED\"}" | grep -q blocked_by_pol && echo BLOCK || echo PASS; }
echo "before the rule: $(late)"
RID=$(curl -s -m 15 -X POST $B/v1/policy/rules -H 'Content-Type: application/json' -d "{\"name\":\"open-models-only (t-late)\",\"action\":\"block\",\"enabled\":true,\"identities\":[{\"type\":\"agent\",\"id\":\"$LID\"}],\"targets\":[{\"kind\":\"network\",\"hostPattern\":\"$H2\",\"method\":\"POST\"}],\"conditions\":[{\"target\":\"body\",\"key\":\"model\",\"operator\":\"not_in\",\"value\":\"$GL\"}]}" | jq -r '.id')
curl -s -m 15 -o /dev/null -X POST $B/v1/policy/publish -H 'Content-Type: application/json' -d '{}'; t0=$(date +%s%N)
for i in $(seq 1 120); do [ "$(late)" = BLOCK ] && break; sleep 0.5; done
echo "rule applied $(( ($(date +%s%N) - t0) / 1000000 )) ms after the publish (tries=$i)"
curl -s -m 15 -o /dev/null -X DELETE "$B/v1/policy/rules/$RID"; curl -s -m 15 -o /dev/null -X POST $B/v1/policy/publish -H 'Content-Type: application/json' -d '{}'; t0=$(date +%s%N)
for i in $(seq 1 120); do [ "$(late)" = PASS ] && break; sleep 0.5; done
echo "rule removed $(( ($(date +%s%N) - t0) / 1000000 )) ms after the publish (tries=$i)"
docker rm -f onecli-v4-test >/dev/null 2>&1
docker exec ${PG:-onecli-lego-postgres-1} sh -c 'psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS onecli_v4test"' | tail -1
echo DRILLS-DONE
