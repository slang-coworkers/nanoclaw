#!/usr/bin/env bash
# Publish coworker artifacts under the 8091 viewer root (~/.local/share/nemo-www):
#   /explanations/<group>/<file>.html  — every coworker's reports/pr-explanations/ (+ newest-first index)
#   /status/latest.html                — the Orchestrator's daily port status report (dated copies alongside)
#   /rows/index.html                   — the rows board: batch → row → a|b|t|r latest task cards (rows-board.py;
#                                        /rows/<ROW>.html per row, card dirs symlinked under /rows/cards/<group>/<thread>/)
#   /index.html                        — the viewer root: one link per surface above (generated here, so a new
#                                        surface is never missing from the landing page)
#   Slack #hermes-port                 — one thread per row: root, role cards, merge line (slack-rows.py; state in
#                                        data/shared/hermes/slack-threads.json; log in logs/slack-rows.log)
# Idempotent; cron every 15 min. Errors are handled explicitly (no set -e: an empty listing is not a failure).
set -u
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac
ROOT=${NANOCLAW_ROOT:-$HOME/haaggarwal/nemoclaw-coworkers}
WWW=${NEMO_WWW_DIR:-$HOME/.local/share/nemo-www}
# Dashboard base URL for the rows board's deep links (row lane + "Live sessions" → #/cw/<folder>/s/<session>).
export DASHBOARD_URL=${DASHBOARD_URL:-https://nv-hermes-xrnpj0b3n.gobrev.dev}
OUT=$WWW/explanations
mkdir -p "$OUT" || exit 1

# Status report: one symlink to the Orchestrator's status dir (latest.html + dated files + history.jsonl).
ln -sfn "$ROOT/groups/orchestrator/reports/status" "$WWW/status"
# Tester evidence: test-report-<sha7>.md + scenario screenshots per thread, linked from PR comments.
ln -sfn "$ROOT/groups/hermes-tester/reports" "$WWW/test-reports"
# Architect ADRs (+ notes, acceptance tests) per requirement: /adr/<req-id-lowercase>.md
ln -sfn "$ROOT/groups/hermes-architect/reports" "$WWW/adr"
# Learnings wiki (L3) and the raw atoms — built daily by the Orchestrator's learnings-wiki task.
ln -sfn "$ROOT/data/shared/wiki"      "$WWW/wiki"
ln -sfn "$ROOT/data/shared/learnings" "$WWW/learnings"

# Explanations: one symlink per coworker group whose dir exists (created on the group's first PR).
for g in "$ROOT"/groups/*/; do
  name=$(basename "$g")
  src="$g/reports/pr-explanations"
  if [ -d "$src" ]; then
    ln -sfn "$src" "$OUT/$name"
  elif [ -L "$OUT/$name" ] && [ ! -e "$OUT/$name" ]; then
    rm -f "$OUT/$name"
  fi
done

LIST=$(find -L "$OUT"/ -mindepth 2 -maxdepth 2 -name '*.html' -printf '%T@ %P\n' 2>/dev/null | sort -rn | head -500)

{
  cat <<'HTML'
<!doctype html><html><head><meta charset="utf-8"><title>PR explanations</title>
<style>body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;max-width:960px;color:#222}
h1{font-size:20px}li{margin:6px 0}code{color:#666;font-size:12px}small{color:#888}</style></head><body>
<h1>PR explanations</h1>
<p>One self-contained page per PR a coworker opened: background, intuition, code walkthrough, quiz. Newest first.
Daily port status: <a href="../status/latest.html">status/latest.html</a> · rows board: <a href="../rows/index.html">rows/</a>.</p>
<ul>
HTML
  if [ -n "$LIST" ]; then
    while read -r ts rel; do
      [ -n "$rel" ] || continue
      d=$(date -d "@${ts%.*}" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$ts")
      echo "<li><a href=\"$rel\">${rel#*/}</a> <code>${rel%%/*} · $d</code></li>"
    done <<< "$LIST"
  else
    echo '<li><em>none yet — the first PR a coworker opens will appear here</em></li>'
  fi
  echo "</ul><p><small>generated $(date '+%Y-%m-%d %H:%M %Z') · source groups/*/reports/pr-explanations/</small></p></body></html>"
} > "$OUT/index.html.tmp" || exit 1
mv -f "$OUT/index.html.tmp" "$OUT/index.html"

# Rows board (/rows/): task cards per gap-matrix row from groups/*/reports/hermes-*/cards/. Never fatal.
python3 "$ROOT/ops/nemoclaw-coworkers/rows-board.py" --root "$ROOT" --www "$WWW" --ncl "$ROOT/bin/ncl" || echo 'rows-board failed'

# Slack mirror: one #hermes-port thread per row (root · role cards · merge line) from the same cards + ledger
# (slack-rows.py; token from $SLACK_BOT_TOKEN or the checkout's .env, host-side only). Idempotent, rate-limited
# to --max-posts per run, logs to logs/slack-rows.log. Never fatal to the viewer refresh.
mkdir -p "$ROOT/logs"
python3 "$ROOT/ops/nemoclaw-coworkers/slack-rows.py" --root "$ROOT" --channel "${SLACK_ROWS_CHANNEL:-C0C14PWDUMC}" >> "$ROOT/logs/slack-rows.log" 2>&1 || true

# Viewer root (/index.html): the landing page. Generated last so every surface published above is linked.
{
  cat <<'HTML'
<!doctype html><html><head><meta charset="utf-8"><title>nemoclaw-coworkers viewers</title>
<style>body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;max-width:960px;color:#222}
h1{font-size:20px}li{margin:6px 0}small{color:#888}</style></head><body>
<h1>nemoclaw-coworkers viewers</h1>
<ul>
<li><a href="rows/index.html">rows/</a> — <b>rows board</b>: batch → gap-matrix row → a|b|t|r latest task cards, live role status (green working · amber idle · red needs input), one page per row (<code>rows/&lt;ROW&gt;.html</code>) with dashboard deep links</li>
<li><a href="status/latest.html">status/latest.html</a> — daily Hermes port status report from the Orchestrator (dated copies in <a href="status/">status/</a>; autopilot report at <a href="status/autopilot.md">status/autopilot.md</a>)</li>
<li><a href="explanations/">explanations/</a> — PR explanations: one self-contained page per coworker PR (background, intuition, code walkthrough, quiz)</li>
<li><a href="test-reports/">test-reports/</a> — hermes-tester evidence: test-report-&lt;sha7&gt;.md and scenario screenshots per thread (linked from PR comments)</li>
<li><a href="adr/">adr/</a> — architect ADRs per requirement (&lt;req-id&gt;.md): criteria, scenario outlines, plugin surface, design</li>
<li><a href="transcripts/">transcripts/</a> — rendered transcripts (group/session/index.html)</li>
<li><a href="trace/">trace/</a> — claude-trace HTML per session (folder__session-id.html)</li>
<li><a href="wiki/index.md">wiki/index.md</a> — learnings wiki (concept pages synthesised daily from the coworkers' learnings); raw atoms under <a href="learnings/">learnings/</a></li>
</ul>
HTML
  echo "<p><small>generated $(date '+%Y-%m-%d %H:%M %Z') by ops/nemoclaw-coworkers/refresh-viewers.sh</small></p></body></html>"
} > "$WWW/index.html.tmp" && mv -f "$WWW/index.html.tmp" "$WWW/index.html" || echo 'viewer root index failed'
