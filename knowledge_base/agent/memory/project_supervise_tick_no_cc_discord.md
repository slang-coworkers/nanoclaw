---
type: feedback
title: Deliver /supervise-issues tick only to orchestrator-dashboard — never CC a coworker
description: Standing guardrail — each /supervise-issues tick delivers its board to orchestrator-dashboard and nowhere else; do NOT CC slang-discord-support or any coworker. Recurs because the tick runs new_session:true, so only this memory survives across fires.
tags: [supervise-issues, routing, discord, guardrail]
---

# Do NOT CC the /supervise-issues tick summary to slang-discord-support (or any coworker) — deliver only to orchestrator-dashboard

Every `/supervise-issues` tick I run has been sending its "Tick N delivered…" summary to the **Slang Discord Support** coworker (`ag-1777389337838-f54d9l`) as an extra CC, on top of the real board delivery to `orchestrator-dashboard`. This is wrong: nothing asks for it (the skill R7 and the scheduled prompt both say deliver ONLY `to="orchestrator-dashboard"`; discord-support's instructions never ask to receive ticks), discord-support does nothing with them, and it's pure noise + token burn in the wrong inbox. It's been happening nearly every tick since ~2026-06-05.

**Why it happens:** I free-associate discord-support as a recipient because its charter says "surface CI health trends to the human maintainer" and the tick is CI-heavy. But that coworker is public-facing Discord support, not a supervisor audience.

**Why it kept recurring after being corrected in chat:** the tick runs `new_session: true` — each fire starts clean with no memory of prior conversation. A live-chat correction evaporates on the next tick. Only durable carriers survive across ticks: this memory, the skill files, and the scheduled prompt / `supervisor-state.json`. That's why this is written here.

**How to apply:** In every `/supervise-issues` tick, the board goes to `orchestrator-dashboard` and NOWHERE else. Do NOT `send_message`/CC/FYI the tick summary to `slang-discord-support` or any other coworker. One delivery, one destination. (Operator asked not to edit the skill/prompt for now — this memory is the guardrail.)
