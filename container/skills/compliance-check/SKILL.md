---
name: compliance-check
license: MIT
type: capability
description: "Weekly read-only score of what the coworker fleet posted against the Contributor AI Standard (ten rules: PR description shape, AI disclosure, comment rationale, newcomer issues, docs, Simple Technical English, bot label, Discord threads). Exports the bot's Discord posts with the Discord read tool, runs scripts/compliance_check.py, and delivers the HTML report. Reads only; never posts, labels, comments or edits."
allowed-tools: Bash(python3:*), Bash(gh api:*), Bash(ls:*), Bash(cat:*), Bash(date:*), Read, Write, mcp__slang-mcp__discord_read_messages, mcp__nanoclaw__send_file, mcp__nanoclaw__send_message
---

# /compliance-check — score the fleet against the Contributor AI Standard

You run in the `eval-compliance` group. Your job is to measure, not to fix: every tool you
call reads, and the only files you write are under `/workspace/agent/reports/compliance/`.
Do not comment on, label, edit or react to any GitHub item or Discord post you look at.

## Procedure

1. **Export the bot's Discord posts.** For each watched channel (the task names the channel
   ids), call `mcp__slang-mcp__discord_read_messages` for the last N days (the task's
   window, default 30) and save the raw tool output to
   `/workspace/agent/reports/compliance/discord-raw-<channel_id>.json` with Write. Then
   convert, appending every channel into one export:

   ```bash
   cd /workspace/agent/reports/compliance
   python3 /home/node/.claude/skills/compliance-check/scripts/discord_export_from_json.py --inspect discord-raw-<channel_id>.json
   python3 /home/node/.claude/skills/compliance-check/scripts/discord_export_from_json.py discord-raw-<channel_id>.json \
       --author nv-slang-bot --channel-type text --channel-id <channel_id> --guild-id <guild_id> >> discord-export.jsonl
   ```

   Start from an empty `discord-export.jsonl` each run. Read the first converted line and
   check that `created_at` is a timestamp and `content` is the post text; if the raw file
   lacks ids, timestamps or author names, say so in your delivery instead of fixing records
   by hand. Never type a record yourself.

2. **Run the check.**

   ```bash
   python3 /home/node/.claude/skills/compliance-check/scripts/compliance_check.py --quiet \
       --since-days 30 --discord-export /workspace/agent/reports/compliance/discord-export.jsonl
   ```

   Exit 0 means every rule scored clean, 1 means findings, 2 means at least one rule could
   not be scored. All three are normal outcomes; report the one you got. The run makes a
   few hundred `gh api` GET calls and, when the gateway is configured, one model call per
   judged PR (capped by `COMPLIANCE_JUDGE_MAX_ITEMS`, default 40).

3. **Deliver.** Send `/workspace/agent/reports/compliance/latest.html` with
   `mcp__nanoclaw__send_file` to the task's destination, with a one-paragraph message: the
   status line the script printed, the pass/total per rule, and each UNKNOWN rule with its
   reason. If `latest.json` has `"complete": false`, say which rules could not be scored and
   why; that is not a pass.

## Where things are

| Path | What |
|---|---|
| `/workspace/agent/reports/compliance/latest.json` | the full report, read by `nanoclaw-metrics.py` as `nanoclaw_compliance` |
| `/workspace/agent/reports/compliance/latest.html` | the page to deliver |
| `/workspace/agent/reports/compliance/runs/<date>.json` | one per run day; the page's previous → current column comes from here |
| `/workspace/agent/reports/compliance/history.log` | one line per run |
| `/workspace/agent/reports/compliance/discord-export.jsonl` | the R10 input you produced in step 1 |

Rules, thresholds, the export shape and the judge's environment are in
[README.md](./README.md). Flags: `--since-days`, `--repos a/b,c/d`, `--discord-export`,
`--out`, `--no-report`, `--quiet`.

## Do not

- Do not run `gh` with any verb other than `api` GET, and do not use `gh pr`, `gh issue`
  or `gh api -X/-f`. The script's own `gh` calls are GET-only by construction.
- Do not open a thread, reply or react on Discord; `discord_read_messages` is the only
  Discord tool this group has, and it is enough.
- Do not edit `scripts/vendor/*.py`; they are the standard's own checkers, copied verbatim.
- Do not write outside `/workspace/agent/reports/compliance/`.
