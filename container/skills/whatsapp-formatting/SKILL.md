---
name: whatsapp-formatting
description: Format messages for WhatsApp, including mentions that render as real WhatsApp tags. Use when responding in a WhatsApp conversation (platform_id / chatJid ends with @s.whatsapp.net or @g.us).
---

# WhatsApp Message Formatting

The Baileys adapter converts markdown automatically, but **mentions only notify with the right syntax** — else they render as plain text. You're in a WhatsApp conversation when the chat JID / `chatJid` ends with `@s.whatsapp.net` (DM) or `@g.us` (group).

## Mentions

To tag a user (bold, clickable, push notification), write `@` then their phone digits only — no `+`, spaces, or name: `@15551234567 can you confirm?`. The adapter renders tags from `@<digits>` (5–15 digits, leading `+` stripped). The sender's JID is in inbound metadata at `content.sender` (e.g. `15551234567@s.whatsapp.net`); the part before `@` is what you put after `@`.

| You write           | Recipients see                                        |
| ------------------- | ----------------------------------------------------- |
| `@Adam ...`         | Plain text `@Adam`. No tag, no notification.          |
| `@15551234567 ...`  | Bold/blue **@Adam** (saved name), notification fires. |
| `@+15551234567 ...` | Same — adapter strips the `+`.                        |

In a group, get the JID from `participants` / `content.sender` — don't guess from display names (pushNames collide). In a DM, tagging is optional. Unknown JID → refer to the person by name in plain prose; don't write `@<name>` (won't tag, looks broken).

## Text styles

Single-character delimiters. The adapter converts standard Markdown (`**bold**`, `[link](url)`, `# heading`) automatically, but a single asterisk is italic, not bold.

| Style           | Syntax          |
| --------------- | --------------- |
| Bold            | `*bold*`        |
| Italic          | `_italic_`      |
| Strikethrough   | `~strike~`      |
| Monospace       | `` `code` ``    |
| Block monospace | ` ```block``` ` |

## What not to do

- No other channels' mention syntax (`<@U123>` Slack, `<@!123>` Discord).
- No full JID like `@15551234567@s.whatsapp.net` — digits only.
- Don't tag display names. WhatsApp has no display-name mention API.
