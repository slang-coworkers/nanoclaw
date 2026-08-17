#!/usr/bin/env bash
# Rebuild the claude-trace transcript index served on :8081.
#
# The HTML files themselves are written LIVE by the claude-trace wrapper
# (container/claude-trace/claude-trace-wrapper.sh), so the symlinks are always
# current -- only the index needs regenerating when new sessions appear. Run
# from cron (every ~15 min) alongside scripts/claude-trace-gc.py.
#
# SYMLINK FIX: some busy groups' dirs are symlinks (e.g. groups/<g> ->
# /ephemeral/...). A recursive `find "$R/groups" -path '*/.claude-trace/*'`
# does NOT descend through those symlinks, so the busiest groups' transcripts
# were silently missing from the index. Using a shell glob
# (`"$R"/groups/*/.claude-trace/`) makes the shell resolve the symlinks first,
# so find operates on the real target dirs. Keep the glob form.
set -u
# Checkout root: override with NANOCLAW_ROOT (the cron/deploy sets it); otherwise
# derive it from this script's location (scripts/ -> repo root).
R="${NANOCLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
WWW="${CLAUDE_TRACE_WWW_DIR:-$HOME/.local/share/claude-trace-www}"
mkdir -p "$WWW"
find "$WWW" -maxdepth 1 -type l -delete 2>/dev/null
{
  echo '<!doctype html><meta charset=utf-8><title>claude-trace transcripts</title>'
  echo '<style>body{font:14px/1.5 system-ui;margin:2rem;max-width:70rem}'
  echo 'table{border-collapse:collapse;width:100%}td,th{padding:.3rem .6rem;border-bottom:1px solid #ddd;text-align:left}'
  echo 'th{font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}</style>'
  echo "<h1>claude-trace transcripts</h1>"
  echo "<p>generated $(date -u '+%Y-%m-%d %H:%M:%SZ') &middot; live files, symlinked from <code>groups/*/.claude-trace/</code></p>"
  echo '<table><tr><th>group</th><th>session</th><th class=n>size</th><th>modified</th></tr>'
  find "$R"/groups/*/.claude-trace/ -maxdepth 1 -name '*.html' -type f -printf '%T@\t%s\t%p\n' 2>/dev/null \
  | sort -rn | while IFS=$'\t' read -r ts sz p; do
      grp=$(basename "$(dirname "$(dirname "$p")")")
      f=$(basename "$p")
      link="${grp}__${f}"
      ln -sfn "$p" "$WWW/$link"
      printf '<tr><td>%s</td><td><a href="%s">%s</a></td><td class=n>%s</td><td>%s</td></tr>\n' \
        "$grp" "$link" "${f%.html}" "$(numfmt --to=iec "$sz")" "$(date -d @"${ts%.*}" '+%Y-%m-%d %H:%M')"
    done
  echo '</table>'
} > "$WWW/index.html.tmp" && mv "$WWW/index.html.tmp" "$WWW/index.html"
echo "claude-trace-www: $(find "$WWW" -maxdepth 1 -type l | wc -l) transcript(s) indexed"
