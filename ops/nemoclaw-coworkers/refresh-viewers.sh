#!/usr/bin/env bash
# Publish coworker artifacts under the 8091 viewer root (~/.local/share/nemo-www):
#   /explanations/<group>/<file>.html  — every coworker's reports/pr-explanations/ (+ newest-first index)
#   /status/latest.html                — the Orchestrator's daily port status report (dated copies alongside)
#   /rows/index.html                   — the rows board: batch → row → a|b|t|r latest task cards (rows-board.py;
#                                        /rows/<ROW>.html per row, card dirs symlinked under /rows/cards/<group>/<thread>/)
# Idempotent; cron every 15 min. Errors are handled explicitly (no set -e: an empty listing is not a failure).
set -u
case $(hostname) in slang-cpu-coworkers*) ;; *) echo "WRONG_HOST=$(hostname)"; exit 1;; esac
ROOT=${NANOCLAW_ROOT:-$HOME/haaggarwal/nemoclaw-coworkers}
WWW=${NEMO_WWW_DIR:-$HOME/.local/share/nemo-www}
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
Daily port status: <a href="../status/latest.html">status/latest.html</a>.</p>
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
python3 "$ROOT/ops/nemoclaw-coworkers/rows-board.py" --root "$ROOT" --www "$WWW" || echo 'rows-board failed'
