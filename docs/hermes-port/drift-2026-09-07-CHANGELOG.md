# gap-matrix 2026-09-07 — fixer pass changelog

Patch: `reports/gap-matrix-2026-09-07.patch` (pristine `scratchpad/gapmatrix/` → edited `scratchpad/gapmatrix-new/`; gap-matrix.md diff first, evidence diff appended).
Policy applied: STAY pinned on `v2026.8.31`, author plugin code against MAIN module paths (compat cliff 2026-09-14); every citation dual-cited `tag:` + `main:`. Every line number below was re-derived by opening the file in the named tree.

## Trap fixes (2)

- **SCHED-F32** · outbound dispatch de-canonicalised: `ctx.dispatch_tool('cronjob_manage', …)` → `ctx.dispatch_tool(_cron_tool(), …)`, plus a new ONE-WAY rule sentence · the rewrite had flipped the OUTBOUND call to the main-only tool name, but `PluginContext.dispatch_tool` bypasses `_LEGACY_TOOL_ALIASES` entirely and `registry.dispatch` on an unknown name *returns* `tool_error("Unknown tool: …")` instead of raising — so on the tree we actually run (`cronjob` at the pin) the mandated pause call would have silently no-opped, recreating the exact fail-open class the row claims to close · main `hermes_cli/plugins.py:679` (def) / `:688` (`registry.dispatch` call), main `tools/registry.py:815-816` (silent `Unknown tool:`), main `tools/registry.py:459` (alias machinery is TOOLSET-only)
- **GOV-F22** · identical ONE-WAY wording appended to the PIN-MOVE RULE so the rule is stated once, correctly: canonicalise names you MATCH, resolve names you DISPATCH at runtime · the fail-open fix in this row is about observed names only; without the second half a reader would apply the alias map to outbound calls too · main `model_tools.py:821` and main `agent/tool_executor.py:357` (used `:422`) are the ONLY alias-application sites; `_cron_tool()` resolves via public `registry.get_entry` (main `tools/registry.py:439`, tag `:536`)

## Scope changes (2)

- **A2A-F20** · scope narrowed to delegation only; "effort MORE" → "effort UNCHANGED" · the no-wake behaviour applies to `type=="async_delegation"` events only; the row's own reply-home vehicle (Bot-Mode DM, `terminal_tool(background=True, notify_on_complete=True)`) emits a `type=="completion"` event that still takes the else branch → `deliver_wake` → a real `role=user` turn, so "reply-home does not wake the caller there" was false for both cited mechanisms · main `gateway/run_notifications.py:842` (def), `:850` (branch), `:854-857` (else) → main `gateway/wake.py:38` `deliver_wake` → `:104` `_self_post_chat_completion`; no type filter upstream (main `gateway/run_notifications.py:898`, `:917`); emitters main `tools/async_delegation.py:276,720,760`; default type main `tools/process_registry_notifications.py:251`
- **MEM-F44** · blast radius extended (on-disk transcript files + VACUUM throttles), and two pieces of unsupported content loss restored · the row said only "DELETED and the DB VACUUMed"; the sweep also removes the on-disk `.json` / `.jsonl` / `request_dump_*` transcripts because both startup call sites pass `sessions_dir` — literally our transcript-retention/cost-data-loss class — while VACUUM is triple-throttled, not unconditional. Restored: the dropped `gateway.telemetry.session_segments.on_compaction` recommendation and the deleted `hooks.md` cite (the only original cite removed outright rather than re-derived) · main `cli.py:1116`, main `gateway/run.py:3591`, docstring main `hermes_state_maintenance.py:376-377` ('issue #3015'), throttles main `hermes_state_maintenance.py:404-409`; restored keys tag/main `website/docs/user-guide/features/built-in-plugins.md:220` and tag/main `website/docs/user-guide/features/hooks.md:24-36` + `:886` (line-identical)

## P0 cite corrections (4)

- **A2A-F21** · `main plugins/platforms/a2a/protocol.py:78` → `:48` (`def max_pingpong_turns()`, env read `:49`), second anchor carried as `TurnTracker` tag `:454` | main `:229` · main `:78` is `"supportedInterfaces": [iface],` in the agent-card builder; behaviour is flag-for-flag unchanged, the numbering is not · main `plugins/platforms/a2a/protocol.py:48`
- **A2A-F21** · `main website/docs/user-guide/bot-mode.md:110` → `:125` (heading '### Failed turns retry safely' at `:123`); tag side re-pointed `:110` → `:114` (heading `:112`) · main `:110` is the unrelated '- **Direct messages**' bullet; tag `:110` is the closing `:::` of the preceding note. Text unchanged, moved · main `website/docs/user-guide/bot-mode.md:125`
- **CRED-F28** · `main agent/proxy_sources/iron_proxy.py:24` → `:1` (module docstring), with an explicit "docstring condensed 55→8 lines, no 1:1 numbering" note · main `:24` is `import time`; the tag's `:24` was a design-summary docstring line about `_IRON_PROXY_VERSION` · main `agent/proxy_sources/iron_proxy.py:1`
- **SCHED-F33** · `main cron/scheduler.py:2064` → `:2055` (`script_path = job.get("script")`; wake-gate block `:2055-2067`), non-wake-gate site noted at `:1267` · main `:2064` is the `**Run Time:**` line of the silent-doc f-string · main `cron/scheduler.py:2055`

## P2 cite corrections (2)

- **ISO-F14** · `main tools/environments/docker_egress.py:52` → `:42` (`proxy_cfg = load_config().get("proxy") or {}`; `enforce_on_docker` read at `:47`) · `:52` is the `logger.warning(… enforce_on_docker=false)` line inside the nested `_degraded()` helper · main `tools/environments/docker_egress.py:42`
- **RT-F01** · `main gateway/slash_access.py:7` → `:8`, note corrected to "the dispatch-site sentence is now at `:8-9`" · `:7` is the backward-compat sentence, not the dispatch-site one · main `gateway/slash_access.py:8`

## P1 systematic `:1` fallback re-points (15 cites across 11 rows)

- **ISO-F12** · `hermes_cli/subcommands/pause.py:1` → `:31` (`cmd_resume`) · the `:1` fallback never lands on the anchored symbol; file byte-identical between trees · main `hermes_cli/subcommands/pause.py:31`
- **ISO-F12** · `gateway/restart.py:1` → `:19` (`EXTERNAL_GATEWAY_SUPERVISOR_ENV`) · same · main `gateway/restart.py:19`
- **ISO-F17** · `gateway/shutdown_watchdog.py:1` → `:45` (`_WATCHDOG_DUMP_RELATIVE`) · same · main `gateway/shutdown_watchdog.py:45`
- **GOV-F26** · `hermes_cli/toolset_scope.py:1` → `:10` (`toolset_allowed_for_platform`) · same · main `hermes_cli/toolset_scope.py:10`
- **GOV-F26** · `gateway/hosted_room_execution_policy.py:1` → `:41` (`from_mapping`) · same · main `gateway/hosted_room_execution_policy.py:41`
- **GOV-F26** · `gateway/platforms/api_server_room_grants.py:1` → `:13` (`class RoomGrantReauthorizationRequired`) · same; line-identical with the tag · main `gateway/platforms/api_server_room_grants.py:13`
- **GOV-F26** · `website/docs/user-guide/managed-scope.md:1` → `:4`, "module docstring" label dropped · `:1` is `---` YAML frontmatter, not a docstring · main `website/docs/user-guide/managed-scope.md:4`
- **LOOP-F38** · `agent/verification_evidence.py:1` → `:27` (`_AD_HOC_SCRIPT_NAME_PREFIXES`) · same · main `agent/verification_evidence.py:27`
- **LOOP-F40** · `skills/software-development/github/references/code-review.md:1` → `:3`, label dropped · markdown, no docstring · main `skills/software-development/github/references/code-review.md:3`
- **MEM-F43** · `skills/research/llm-wiki/SKILL.md:1` → `:18`, label dropped · `:1` is `---` frontmatter · main `skills/research/llm-wiki/SKILL.md:18`
- **OBS-F45** · `website/docs/user-guide/features/web-dashboard.md:1` → `:9`, label dropped · markdown · main `website/docs/user-guide/features/web-dashboard.md:9`
- **OBS-F47** · `tools/session_search_tool.py:1` → `:4` (the DISCOVERY sentence) · `:1` is the shebang; the docstring starts at `:2` · main `tools/session_search_tool.py:4`
- **OBS-F48** · `docs/observability/monitoring.md:1` → `:23`, label dropped · markdown · main `docs/observability/monitoring.md:23`
- **SELF-F57.a** · `hermes_cli/plugin_dev.py:1` → `:26` (`_deny_network`) · same · main `hermes_cli/plugin_dev.py:26`
- **SELF-F57.b** · `website/docs/guides/cron-script-only.md:1` → `:9`, label dropped · markdown · main `website/docs/guides/cron-script-only.md:9`

## Knock-on

- **OPS-F58.a** · hygiene-stance note mirrors MEM-F44's added clause (on-disk transcript deletion + VACUUM throttles) · the row points at MEM-F44 for the `auto_prune` flip, so it must carry the same blast radius · main `cli.py:1116`, main `gateway/run.py:3591`, main `hermes_state_maintenance.py:376-377`, `:404-409`

## Counts

| Metric | Value |
|---|---:|
| Rows changed (this fixer pass, unique ids) | **21** |
| — in `gap-matrix.md` | 5 (A2A-F20, GOV-F22, SCHED-F32, MEM-F44, OPS-F58.a) |
| — in `gap-matrix-evidence.md` | 20 |
| Discrete edits applied | 37 (all 13 corrections; reverse-apply verified clean) |
| Cite occurrences added (this pass) | **+98** (36 in gap-matrix.md, 62 in evidence) |
| Cite occurrences replaced/removed (wrong main line numbers) | 22 |
| New cite bullets in evidence | 2 (MEM-F44, declared count 12 → 14) |
| Cumulative vs pristine (what the patch shows) | gap-matrix.md 22 → 246 cite occurrences; evidence 577 → 2497 |
| `main: not found` entries remaining in evidence | **1** (RT-F01, `gateway/slash_access.py` PR #4443 provenance paragraph — pre-existing, correct) |
| Total 61-row table integrity | 61 rows, no new malformed table rows |
