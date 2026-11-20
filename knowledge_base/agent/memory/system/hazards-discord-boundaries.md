---
type: system
title: Discord posting boundaries
description: Who can post where on Discord — the Slang Maintainer is read-only with one weekly surface, and the bot fleet's send allowlist covers only the watched forums.
---

# Discord posting boundaries

**Maintainer role boundary (11-18, its own statement):** the Slang Maintainer's Discord access is **read-only by role and
allowlist** — its only post surface is the weekly PR report in #slang-committers. So Discord user-facing replies/flags
(h7per-class community debt, dev-channel flags) route to **slang-discord-support** (or stay human action items), never to the
maintainer; conversely its channel READS failing (the day-2 gap) degrade only its sweeps, not the fleet's posting ability.

**Bot Discord send-allowlist boundary (11-18, measured on the h7per reply):** slang-mcp's `discord_send_message` is gated to an
allowed-channel list — **the watched forums only**. #slang-discussion (`1305995870046650368`) and other source channels are
read-only for the whole bot fleet (slang-discord-support refused + correctly did not raw-API bypass). So community replies in
source channels (h7per-class owed answers) reach "drafted + verified" and then need an operator choice: allowlist the channel, or
a human posts verbatim. Route those asks as operator decisions with the draft inline; don't dispatch them expecting a post.
