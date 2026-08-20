---
type: project
title: "2026-05-18 session — Discord workflow modernization + ccusage 19 schema break + recompose-on-boot + lego eager Gateway. Both lego and prod"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# 2026-05-18 session — Discord workflow modernization + ccusage 19 schema break + recompose-on-boot + lego eager Gateway. Both lego and prod updated. Major chain: PRs #347/#351/#352/#356/#359/#360/#361/#362/#363/#364/#365.

Big day. End-to-end Discord supervision rework + dashboard cost-panel rescue + host startup-time CLAUDE.md refresh. All deployed to lego AND prod.

## What landed

| PR | Branch | Effect |
|---|---|---|
| #347 | nv-slang | DISCORD_READ_ONLY env gate (per-tool defense for lego) |
| #351 | nv-slang | DISCORD_POST_SUMMON gate default-off in slang-mcp on_thread_create |
| #352 | nv-main | reapProcessTree + --sessionTimeout=600000 — bounded the 38+-orphan supergateway leak |
| #356 (someone else) | nv-slang | Forum continuation flow + 15-reply cap + Resolved button + thread_state.jsonl. **Removed slang-mcp on_thread_create entirely.** |
| #359 | nv-slang | Re-added on_thread_create gated by DISCORD_POST_SUMMON, restored READ_ONLY gates, added eager `init_discord_client()` to slang-mcp arun() |
| #360 | nv-slang | Made eager init opt-in via `DISCORD_EAGER_INIT=1`, default off — protects prod from accidental double-Gateway when feedback_collector is the canonical poster |
| #361 | nv-slang | Rewrote slang-discord-answer WORKFLOW + spine context + critique overlay for the post-#356 architecture (push wakeup, 15-cap, branched output by allowlist). Trimmed from 160→39 lines per user feedback "guidelines not scaffolding" |
| #362 | nv-main | Recompose every group's CLAUDE.md at NanoClaw startup. Closes the deploy-confidence gap where idle coworkers' composed files stayed stale until next wake (host-sweep's claude-md-stale only iterates RUNNING containers) |
| #363 | nv-dashboard | ccusage 19+ schema fix — period→date alias + synthesized modelBreakdowns + parser hardened. Cost panel was showing $0.00 for everyone. |
| #364 | nv-main | Downgrade MCP auth proxy 5m-timeout from ERROR → INFO (sessionTimeout firing is expected post-#352, was loud noise) |
| #365 | nv-dashboard | Filter ccusage to Claude-only — fixes codex global mis-attribution. ccusage 19 ignores CLAUDE_CONFIG_DIR for codex; without filter, $78 of host-wide gpt-5.5 spend mis-attributed across coworkers |

## Lego config (haaggarwal) — current end state

`.env` carries an explicit "LEGO-ONLY" header block (with screaming warning DO NOT COPY TO PROD):

```
DISCORD_BOT_TOKEN=<prod's bot token, same identity>
DISCORD_READ_ONLY=1                     # hard-blocks every Discord write
DISCORD_EAGER_INIT=1                    # Gateway connects at slang-mcp startup
DISCORD_POST_SUMMON=0                   # explicit (default anyway)
DISCORD_ALLOWED_SEND_CHANNELS=          # empty (no allowlisted writes)
DISCORD_ALLOWED_SEND_FORUMS=            # empty
DISCORD_FEEDBACK_DIR=/home/ubuntu/haaggarwal/lego-nanoclaw/groups/slang-discord-support/memory/feedback
DISCORD_WATCHED_FORUMS=1494023079666647200,1313936640661524601
MCP_SESSION_TIMEOUT_MS=600000           # prod default
```

Three independent layers prevent posting on lego: agent allowlist excludes `discord_send_message`, DISCORD_READ_ONLY=1 blocks per-tool, DISCORD_POST_SUMMON=0 blocks on_thread_create. **No `feedback_collector.py` runs on lego** — different from prod.

## Prod config — unchanged on purpose

Prod's `.env` has only `DISCORD_BOT_TOKEN` and `DISCORD_*_FORUMS`. **No `DISCORD_EAGER_INIT`, no `DISCORD_READ_ONLY`, no `DISCORD_POST_SUMMON`.** This means:
- Eager init does NOT fire on prod's slang-mcp (Gateway stays lazy)
- `feedback_collector.py` (always-on systemd unit `nanoclaw-prod-discord-feedback.service`) remains the sole Gateway holder + button poster
- Existing prod behavior fully preserved

PR #360 was specifically required to keep prod safe — without it, PR #359's eager init would have created a 2nd Gateway on prod alongside feedback_collector.

## Critical findings during the session

- **Prod's `slang-discord-support` is `coworker_type=''` (untyped).** PR #361's spine/workflow/overlay updates have ZERO runtime effect on prod — prod runs entirely off `groups/slang-discord-support/.instructions.md`. See [[project-lego-discord-readonly]].
- **ccusage 19+ ignores `CLAUDE_CONFIG_DIR` for codex.** Auto-detects all installed agents globally regardless of env scoping. [[reference-onecli-injection-modes]] is similar pattern (env-var injection promised but not delivered).
- **Per-session codex/ dirs are essentially never created on lego or prod.** Out of 134 sessions across 4 installs, only 2 have session-local codex/. The "by-coworker codex cost" view was lying without filter.
- **host-sweep's `claude-md-stale` only iterates RUNNING containers.** Idle coworkers' CLAUDE.md stay stale until next wake — see PR #362 for fix.
- **The 38+ supergateway orphans on prod were reaped on the deploy** by PR #352's reapProcessTree (verified post-deploy: 1 child only).

## How to apply

- **Lego config drift check**: every operator-edit to lego's `.env` should preserve the LEGO-ONLY warning block. If you ever copy lego's `.env` to a fresh install, strip the DISCORD_EAGER_INIT/READ_ONLY/POST_SUMMON lines unless that install is also read-only.
- **New install bring-up**: prod-style installs leave all three Discord env flags UNSET. Lego-style read-only installs set all three.
- **After a deploy that includes spine/workflow changes**: PR #362's recompose-on-boot guarantees fresh `groups/*/CLAUDE.md` at every restart. No manual wake needed.
- **If supergateway children grow unbounded again**: check `pgrep -af 'lego-nanoclaw.*supergateway' | head -3` shows ONE supergw with `--sessionTimeout 600000` in cmdline; check `ps --ppid <supergw-pid> --no-headers | wc -l` for child count. Steady state ≈ 1 + active container count.
- **If dashboard cost panel shows $0**: check `logs/nanoclaw-dashboard.error.log` for `mergeDailyEntries` TypeErrors; if present, ccusage upstream may have changed schema again. Update `normalizeCcusageEntry` accordingly. See [[feedback-rebuild-dist-after-merge]].

Cross-links: [[project-supergateway-leak-architecture]] [[project-lego-discord-readonly]] [[feedback-env-no-inline-comments]] [[project-slang-mcp-gateway-lazy]]

