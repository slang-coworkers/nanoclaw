---
type: project
title: Compliance-check skill patch (R10 author filter + R7 judge truncation), pending operator apply
description: Verified patch for the two recurring compliance-check defects, why this week's R1/R5/R9 zero-pass is real drift, and the R10 numbered-parts finding
tags: [compliance-check, skills, operator-pending]
---

# Compliance-check skill patch — pending operator apply (2026-11-16)

The 2026-11-16 weekly run (window since 10-17, 726 items) reported R10 "OK, no items in window" — vacuous for the **third week running** because the export filters Discord on `--author nv-slang-bot` while the bot posts as **SlangMaintainerBot** (id 1352501374021140480). R7 had 12 of 123 undecided because the judge's `max_tokens: 400` truncates replies mid-JSON (2nd week running; 13 on 11-02). The skills registry is ro in-container (see system/skills-registry-readonly.md), so I could not apply the fix myself.

**The patch**: `/workspace/agent/reports/compliance-check-fix-2026-11-16.patch` — apply with `patch -p1` from the registry's `skills/` parent (host-side). Changes:
- `discord_export_from_json.py`: default `--author` → `SlangMaintainerBot`; loud WARNING naming the authors seen when the filter matches 0 (self-correcting guard).
- `SKILL.md`/`README.md`: correct flag + explicit "nv-slang-bot is the GitHub login, not the Discord author" + "a vacuous R10 OK is not a pass".
- `compliance_check.py`: judge `max_tokens` 400 → 2000; `stop_reason == "max_tokens"` → UNJUDGED with a named truncation reason.
- tests updated (Discord fixtures → SlangMaintainerBot) + 2 new tests; suite green except 3 failures identical in the pristine copy (env-dependent: MetricsTest wants repo layout, proxy opener test wants clean env).

**Score interpretation for 2026-11-16** (verified by live spot-check of PR #14452):
- R1/R5/R9 zero-pass is **real drift, not a check bug**: the vendored standard (szihs slang PRs #13584/#13586, still unmerged proposals) requires `Motivation/Approach/Key choices/Evidence` sections, an explicit `AI assistance:` line, and a `bot` label — the fleet's PRs use `Summary/Root cause/Tests/Risk` + 🤖 `<sub>` footer and no bot label. Whether to adopt the proposed template is a maintainer/operator decision.
- R10 real finding (side check): 29/32 bot Discord posts are numbered "(part k/N)" posts in channel 1352357976878481468 (weekly PR report split into parts, not threaded).
- Bot's last Discord post 11-09; bots down for maintenance since 11-11 — explains the item drop from 1406.

If next week's run still shows R10 "no items in window", the task prompt itself (in the eval-compliance group's task list, host-side) carries the stale flag — worth checking after the patch is applied.
