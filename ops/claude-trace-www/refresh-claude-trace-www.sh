#!/usr/bin/env bash
# Rebuild the trace index served on :8081.
# Claude Code sessions: the claude-trace wrapper writes groups/*/.claude-trace/*.html live.
# OpenCode sessions: opencode-trace-html.py renders groups/*/.opencode-trace/session-*.jsonl to .html
# (only traces from the last 2 days that are newer than their page). Both are listed in one table.
set -u
R="$HOME/slang-coworkers-prod/nanoclaw"
WWW="$HOME/.local/share/claude-trace-www"
# The repo copy of the converter wins; the box-local copy is the fallback for a checkout that predates it.
CONV="$R/scripts/opencode-trace-html.py"
[ -f "$CONV" ] || CONV="$HOME/.config/nanoclaw/opencode-trace-html.py"
mkdir -p "$WWW"
[ -f "$CONV" ] && timeout 600 python3 "$CONV" --all "$R" --since-min 2880 2>>"$HOME/.config/nanoclaw/opencode-trace-html.err" | tail -1
find "$WWW" -maxdepth 1 -type l -delete 2>/dev/null
{
  echo '<!doctype html><meta charset=utf-8><title>claude-trace transcripts</title>'
  echo '<style>body{font:14px/1.5 system-ui;margin:2rem;max-width:76rem}'
  echo 'table{border-collapse:collapse;width:100%}td,th{padding:.3rem .6rem;border-bottom:1px solid #ddd;text-align:left}'
  echo 'th{font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}td.b{color:#555}</style>'
  echo "<h1>claude-trace transcripts</h1>"
  echo "<p>generated $(date -u '+%Y-%m-%d %H:%M:%SZ') &middot; Claude Code pages from <code>groups/*/.claude-trace/</code>, OpenCode pages from <code>groups/*/.opencode-trace/</code></p>"
  echo '<table><tr><th>group</th><th>backend</th><th>session</th><th class=n>size</th><th>modified</th></tr>'
  find "$R"/groups/*/.claude-trace/ "$R"/groups/*/.opencode-trace/ -maxdepth 1 -name '*.html' -type f -printf '%T@\t%s\t%p\n' 2>/dev/null \
  | sort -rn | while IFS=$'\t' read -r ts sz p; do
      dir=$(basename "$(dirname "$p")")
      grp=$(basename "$(dirname "$(dirname "$p")")")
      case "$dir" in .opencode-trace) be=opencode; pre=oc;; *) be=claude; pre=ct;; esac
      f=$(basename "$p")
      link="${grp}__${pre}__${f}"
      ln -sfn "$p" "$WWW/$link"
      printf '<tr><td>%s</td><td class=b>%s</td><td><a href="%s">%s</a></td><td class=n>%s</td><td>%s</td></tr>\n' \
        "$grp" "$be" "$link" "${f%.html}" "$(numfmt --to=iec "$sz")" "$(date -d @"${ts%.*}" '+%Y-%m-%d %H:%M')"
    done
  echo '</table>'
} > "$WWW/index.html.tmp.$$" && mv "$WWW/index.html.tmp.$$" "$WWW/index.html"
echo "claude-trace-www: $(find "$WWW" -maxdepth 1 -type l | wc -l) page(s) indexed ($(find "$WWW" -maxdepth 1 -type l -name '*__oc__*' | wc -l) OpenCode)"
