# claude-trace-www — the trace index on :8081

`refresh-claude-trace-www.sh` builds the page that `https://claude-trace-<box>.brevlab.com` serves. It runs from
cron every 15 minutes as `~/.config/nanoclaw/refresh-claude-trace-www.sh`, and a `python3 -m http.server 8081`
(started at boot) serves `~/.local/share/claude-trace-www/`.

- Claude Code sessions: the claude-trace wrapper writes `groups/*/.claude-trace/*.html` live.
- OpenCode sessions: the script renders `groups/*/.opencode-trace/session-*.jsonl` with
  `scripts/opencode-trace-html.py` (traces from the last 2 days that are newer than their page), then lists both
  kinds in one table with a backend column.

Deploy: copy the script to `~/.config/nanoclaw/` on the box. The pages hold prompts and replies, so they stay
behind the same access as the trace files.
