---
name: slack-formatting
license: MIT
description: Format messages for Slack using mrkdwn syntax. Use when responding to Slack channels (folder starts with "slack_" or JID contains slack identifiers).
---

# Slack Message Formatting (mrkdwn)

When responding to Slack channels, use Slack mrkdwn, not standard Markdown. Detect Slack context when the group folder / workspace path starts with `slack_` (e.g. `slack_engineering`).

## Text styles

| Style         | Syntax         |
| ------------- | -------------- |
| Bold          | `*text*`       |
| Italic        | `_text_`       |
| Strikethrough | `~text~`       |
| Code (inline) | `` `code` ``   |
| Code block    | ` ```code``` ` |

## Links and mentions

```
<https://example.com|Link text>     # Named link
<https://example.com>                # Auto-linked URL
<@U1234567890>                       # Mention user
<#C1234567890>                       # Mention channel
<!here>  <!channel>                  # @here / @channel
```

## Lists, quotes, emoji

- Bullets only (no numbered lists): `•`, `- `, or `* `.
- Block quotes: lines prefixed with `> ` (can span multiple lines).
- Emoji shortcodes: `:white_check_mark:`, `:x:`, `:rocket:`, `:tada:`.

## What NOT to use

- `##` headings → use `*Bold text*`.
- `**double asterisks**` → use `*single*`.
- `[text](url)` → use `<url|text>`.
- `1.` numbered lists → bullets, e.g. `• 1. First`.
- Tables → code blocks or plain text.
- `---` horizontal rules.

## Example

```
*Daily Standup Summary*

_March 21, 2026_

• *Completed:* Fixed authentication bug in login flow
• *In Progress:* Building new dashboard widgets
• *Blocked:* Waiting on API access from DevOps

> Next sync: Monday 10am

:white_check_mark: All tests passing | <https://ci.example.com/builds/123|View Build>
```

## Sending messages

- `mcp__nanoclaw__send_message` — `text` accepts mrkdwn directly, no conversion.
- `mcp__nanoclaw__send_card` — structured panels; renders as Slack Block Kit (`title`, `fields`, `color`).
- `mcp__nanoclaw__send_file({ path, text?, filename? })` — send large outputs as a file, never paste inline.
