---
type: project
title: "Discord: prod is the live poster; dev/lego is read-only — prod NEVER gets DISCORD_READ_ONLY"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Discord: prod is the live poster; dev/lego is read-only — prod NEVER gets DISCORD_READ_ONLY

The dev (lego) instance runs Discord as a live **read-only** listener (`DISCORD_READ_ONLY=1` in its .env, three independent write-gates) so it can observe forum messages without double-posting as the shared bot identity. **Prod is the instance that actually posts** — prod must NEVER set `DISCORD_READ_ONLY`. If prod Discord posting breaks, it is not this flag (prod doesn't have it); see the discord-no-proxy gotcha (container Discord 401s came from discord.com in NO_PROXY bypassing OneCLI token injection).
