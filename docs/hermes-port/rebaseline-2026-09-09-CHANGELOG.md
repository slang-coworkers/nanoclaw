# Re-baseline changelog — 61 rows, 53 verifier findings applied

Inputs: `rows.json` (assessor, 61 rows) + `findings.json` (verifier, 53 findings).
Output: `rows-final.json` (61 rows, same shape, same ids, each exactly once).

Disposition vocabulary enforced: `ADOPT | CONFIGURE | BUILD | MERGE→<id> | DEFER`.
**No stray values were present** — the assessor's 61 rows already used only legal strings (no `PLUGIN`), so no value-repair was needed; the changes below are re-dispositions forced by findings, plus field rewrites.
Every `MERGE→<id>` target is a `BUILD` row: no chained merges.

---

## Per row: assessor → final

| id | assessor | final | why |
|---|---|---|---|
| OBS-F45 | ADOPT | ADOPT | Unchanged verdict; note now says the Bots list is gated on rendered `ui_meta['hermes-bots']` and that rooms are an operator bring-up step, not a rendered surface (f28). |
| OBS-F46 | CONFIGURE | CONFIGURE | Deliverable moved from per-profile `.env` to the gateway **process** env (`os.getenv`, profile .env only reaches the secret scope); dump path corrected to `request_dump_<sid>_*.json` beside session files (f30, f46, f24). |
| OBS-F47 | ADOPT | ADOPT | No finding; carried verbatim. |
| OBS-F48 | BUILD | **MERGE→GOV-F25** | Same artifact key, same two feeds and a cost roll-up that must join GOV-F25's ownership index — one `nv-artifact` plugin, not three; OTLP publication dropped (closed event set) (f8, f9, f35). |
| CH-F49 | ADOPT | ADOPT | Unchanged; added the port-binding rule (webhook/api_server only on the default profile) to the doc deliverable (f22). |
| CH-F50 | ADOPT | ADOPT | Unchanged; records that the desktop panel's transport has no `send_exec_approval`, so cards render as text there (f11). |
| CH-F51 | MERGE→A2A-F18 | **MERGE→LOOP-F37** | Retargeted to the single veto owner so the criterion is not buried behind a chained merge; rooms provisioned via `groups.*` RPC (f1, f20, f28). |
| CH-F52 | CONFIGURE | CONFIGURE | Routes render into the **default** profile with `profile:` bindings (a coworker enabling `webhook` is skipped at startup); acceptance made hermetic (f22, f38). |
| CH-F53 | DEFER | DEFER | Unchanged; now states that because it is deferred, no peering config or gate ships anywhere else (f37). |
| SELF-F54 | MERGE→SELF-F56 | **MERGE→LOOP-F35** | Retargeted because SELF-F56 itself folded into LOOP-F35 (f7). |
| SELF-F55 | CONFIGURE | CONFIGURE | `hermes profile install --ref` does not exist (tracks the default branch); pinning is by source-branch immutability + `hermes profile info` SHA, and `--force-config` is required on update (f41). |
| SELF-F56 | BUILD | **MERGE→LOOP-F35** | Same renderer with a second front door (second manifest, settings block, golden test); folded, keeping the onboard verbs + the Bot-Mode identity/room bring-up (f7, f26). |
| SELF-F57 | ADOPT | ADOPT | 'Bump a ref / break a ref' replaced with default-branch re-pull + SHA identity; `--force-config` caveat added (f42). |
| SELF-F57.a | DEFER | DEFER | No finding; carried verbatim. |
| SELF-F57.b | CONFIGURE | CONFIGURE | Unchanged; write access to the shared dir explicitly delegated to MEM-F43 (f33/f43). |
| OPS-F58 | ADOPT | ADOPT | Criterion rewritten: native `hermes` verbs are the operator's (inert in a sandbox with no `$HERMES_HOME`), the refusal is by tool name on orchestrator-only plugin tools; room-admin residue corrected (f12, f53). |
| OPS-F58.a | CONFIGURE | CONFIGURE | Pin `sessions.auto_prune: false` on the **default** profile too + explicit `checkpoints.auto_prune`; `container_boot` re-cited as one-gateway-per-profile, so the fleet starts one multiplexer slot (f24, f25). |
| SCHED-F32 | ADOPT | ADOPT | Unchanged; the two missing behaviours point at the single `nv-fleet-gates` callback rather than 'the veto hook' generically (f1/f20). |
| SCHED-F33 | CONFIGURE | CONFIGURE | Cite corrected — `cron.failure_nudge_threshold` is not in `config_defaults.py`; render must emit it by value (f52). |
| SCHED-F34 | CONFIGURE | CONFIGURE | No finding; carried verbatim (sandbox TZ wording aligned to the P4 terminal block). |
| LOOP-F35 | BUILD | BUILD | Absorbs SELF-F56's three verbs; now also renders `ui_meta['hermes-bots']` via the profile-configure RPC, the canonical Bot Chat, standing rooms via `groups.create`, and the default-profile keys; `kind: standalone` (f7, f18, f22, f24, f26, f47). |
| LOOP-F36 | MERGE→LOOP-F35 | MERGE→LOOP-F35 | Unchanged. |
| LOOP-F37 | BUILD | BUILD | **Now owns the fleet's single `pre_tool_call` plugin `nv-fleet-gates`** (ordered predicate chain, blocks before approves), because first-directive-wins made three plugins order-dependent and P3-before-P4 impossible; fail-closed is the plugin's own `try/except` (core swallows raises); `execute_code` and host-side `skill_manage` added as chokepoints (f1, f2, f18, f20, f31, f33/f43, f39, f50). |
| LOOP-F38 | MERGE→LOOP-F37 | MERGE→LOOP-F37 | Unchanged target; phrased as a predicate on the one callback; non-existent kanban keys replaced with the real ladder (f19, f20). |
| LOOP-F39 | CONFIGURE | CONFIGURE | `kanban.stranded_threshold_seconds` / stranded_in_ready do not exist — replaced with `dispatch_stale_timeout_seconds`, `failure_limit`, `reconcile_orphans`, per-task `max_runtime_seconds` (f19). |
| LOOP-F40 | CONFIGURE | CONFIGURE | Routes render on the default profile (rendering into the reviewer profile would silently take it offline); per-route `toolsets` is coarse, so the veto — not the grant — is the uninvited-comment gate (f22, f50). |
| MEM-F41 | CONFIGURE | CONFIGURE | Unchanged; notes memory writes are host-side, so isolation rests on HERMES_HOME resolution + the veto path predicate (f33/f43). |
| MEM-F42 | CONFIGURE | CONFIGURE | No finding; carried verbatim. |
| MEM-F43 | CONFIGURE | CONFIGURE | Enforcement moved off the read-only mount (`skill_manage` writes host-side): unset `skills.create_dir` for non-promoters + a veto path predicate; mount is defence in depth (f33, f43). |
| MEM-F44 | CONFIGURE | CONFIGURE | Pin written into the **default (multiplexer)** profile as well — the startup sweep reads the launch profile's config; `checkpoints.auto_prune` decided explicitly (f24). |
| A2A-F18 | BUILD | **MERGE→LOOP-F37** | The wiring veto is a predicate on the one callback, not a second plugin; `delegate_task` un-gated (no profile arg); rooms are not rendered; `a2a_call` not registered (f1, f17, f20, f28, f37). |
| A2A-F19 | MERGE→A2A-F18 | **MERGE→LOOP-F37** | Follows the veto owner; adds the honest limit that a gated edge in an unattended session is denied, not held (f1, f13, f20). |
| A2A-F20 | ADOPT | ADOPT | Unchanged; veto reference renamed and the canonical Bot Chat dependency (LOOP-F35) made explicit. |
| A2A-F21 | CONFIGURE | CONFIGURE | Managed scope kept only because the guardrail block is fleet-uniform (per-profile pins are impossible); `A2A_MAX_PINGPONG_TURNS` dropped with CH-F53 (f6, f37). |
| GOV-F22 | MERGE→GOV-F26 | **MERGE→LOOP-F37** | Follows the veto owner (GOV-F26 is itself a criterion there); fail-closed criterion restated — core does not block on a raising callback (f1, f2, f20). |
| GOV-F23 | CONFIGURE | CONFIGURE | Three unattended contexts, incl. `single_query_mode` for kanban workers; deny paired with per-role `command_allowlist` + `deny[]` floor so the fixer is not wedged; managed-scope pinning split (f6, f13, f27, f45). |
| GOV-F24 | BUILD | BUILD | Plugin-capability gate removed (closed registry, unknown ids dropped) → `check_fn` + fail-closed `writers` setting + veto belt; stays its own plugin under f8's stated escape hatch, sharing the one `pre_gateway_dispatch` webhook seam (f5, f8, f9, f29). |
| GOV-F25 | BUILD | BUILD | Becomes `nv-artifact` and absorbs OBS-F48 (ownership + outcomes in one plugin_db); observer watches `execute_code` too; webhook seam is `pre_gateway_dispatch` (f8, f9, f18, f31). |
| GOV-F26 | BUILD | **MERGE→LOOP-F37** | 'One small plugin plus per-profile config' = the fleet-admin predicate on the single callback; managed scope carries only fleet-uniform keys; phase moves P5 → P3-waveA (f1, f6, f20). |
| GOV-F27 | CONFIGURE | CONFIGURE | Per-profile `mcp_servers` cannot be pinned machine-wide → veto denies `mcp_*` outside the rendered allow-list; per-profile MCP credential attribution named as an O4 residual (f15, f44). |
| CRED-F28 | BUILD | BUILD | Shrunk to the credential half: no `TerminalEnvironmentProvider` (it would forfeit egress wiring, collision guards, host-access classification, orphan reaping); docker+podman backend with the hop's upstream at OneCLI; SecretSource narrowed to proxy coordinates (f4, f14, f21). |
| COST-F29 | BUILD | BUILD | Enforcement never raises (middleware swallows and calls the provider anyway) — refuse by return + ESTOP + `pre_tool_call`; native `sessions.estimated_cost_usd` / `session_model_usage` are the authoritative read; codex path covered (f10, f23, f36). |
| COST-F30 | BUILD | BUILD | Decision routed through Hermes's own approval gate (the panel renders it) with `/cost` text path and buttons as an adapter bonus; click authz reads the plugin's own `operators` setting, removing the P5 dependency (f11, f32). |
| COST-F31 | ADOPT | ADOPT | Unchanged; note now states these are the numbers COST-F29 enforces on. |
| RT-F01 | CONFIGURE | CONFIGURE | Webhook routes render on the default profile; `ui_meta` / rooms are explicitly NOT rendered (not distribution-owned, no CLI verb) and become a recorded thin spot (f22, f47). |
| RT-F02 | CONFIGURE | CONFIGURE | Rooms are provisioned through `groups.*` JSON-RPC by onboarding/the desktop app, not by the compose render (f28). |
| RT-F03 | CONFIGURE | CONFIGURE | Session-mode keys are per (profile, platform), and `thread_sessions_per_user` semantics inverted in the original note (f48). |
| RT-F04 | DEFER | DEFER | No finding; carried verbatim. |
| RT-F05 | ADOPT | ADOPT | No finding; carried verbatim. |
| RT-F06 | DEFER | DEFER | Unchanged; revival home renamed to the `nv-artifact` plugin, which already holds the one inbound observer (knock-on of f8). |
| RT-F07 | ADOPT | ADOPT | `send_message` is not agent-callable — the addressing model is adopted for host-side senders and the three agent surfaces (MCP server, `hermes send` in-sandbox, orchestrator-only plugin tool) are named; cards moved to their real transports; hint de-coupled from a live Slack (f3, f38, f40). |
| RT-F08 | ADOPT | ADOPT | No finding; carried verbatim. |
| RT-F09 | ADOPT | ADOPT | `session:start` is not a `VALID_HOOKS` name (silent no-op) — corrected to `on_session_start/end/reset` with a warning carried for every row wanting lifecycle events (f49). |
| ISO-F10 | BUILD | **MERGE→LOOP-F37** | The sandbox veto is a predicate on the one callback, inert (`enforce_sandbox: false`) until P4; MCP named as a documented exception; host-side writers and the pin caveat folded in (f1, f15, f20, f33/f43, f39). |
| ISO-F11 | ADOPT | ADOPT | Unchanged; PR index cross-referenced to GOV-F25. |
| ISO-F12 | ADOPT | ADOPT | Unchanged; noted that COST-F29 reuses the ESTOP sentinel as its authoritative stop. |
| ISO-F13 | CONFIGURE | CONFIGURE | Workspace root rendered OUTSIDE `$HERMES_HOME` (the invariant that carries GOV-F24/F26/F27's immutability) + `docker_mount_cwd_to_workspace: true` for kanban workers + explicit `container_persistent` (f16, f27, f34). |
| ISO-F14 | CONFIGURE | CONFIGURE | Exactly one egress topology per profile (docker backend keeps the fail-closed spawn and collision guards; OneCLI via the hop's upstream); scope statement added — host-side MCP egress is not covered (f4, f21, f51). |
| ISO-F15 | CONFIGURE | CONFIGURE | Split by execution surface: `tools/terminal_scope.py` is main-only, so per-profile sandboxes are configuration for kanban/cron processes while gateway-served tool calls are blocked-on-pin-move (f39). |
| ISO-F16 | CONFIGURE | CONFIGURE | Unchanged; pinning/`--force-config` caveat inherited from SELF-F55/SELF-F57 (f42). |
| ISO-F17 | ADOPT | ADOPT | `container_boot` re-cited as per-profile gateway slots; the fleet starts exactly one multiplexer PID (f25). |

## Disposition counts (final)

| disposition | count |
|---|---|
| CONFIGURE | 23 |
| ADOPT | 16 |
| MERGE→ | 11 |
| BUILD | 7 |
| DEFER | 4 |
| **total** | **61** |

Movement vs the assessment: BUILD 12 → 7 (OBS-F48, SELF-F56, A2A-F18, GOV-F26, ISO-F10 folded); MERGE 6 → 11; ADOPT 16 → 16; CONFIGURE 23 → 23; DEFER 4 → 4.
The seven surviving BUILDs are five plugins: `nv-coworker-compose` (LOOP-F35), `nv-fleet-gates` (LOOP-F37), `nv-artifact` (GOV-F25), `nv-approval-ledger` (GOV-F24), `nv-cost-cap` (COST-F29 + COST-F30), `podman-onecli` (CRED-F28).

## Findings applied (all 53; none skipped)

Numbered in `findings.json` file order.

**must-fix (20/20 applied)**
1. Four rows → one `pre_tool_call` plugin — applied (see deviation D1). 2. Fail-closed is the plugin's obligation, not core's — applied to LOOP-F37, A2A-F18, A2A-F19, GOV-F22. 3. RT-F07 `send_message` not agent-callable — applied (with f40). 4. ISO-F14/CRED-F28 egress conflict — applied (single topology, docker backend). 5. GOV-F24 plugin capability is a closed registry — applied. 6. Managed scope cannot hold per-profile values — applied to GOV-F26, GOV-F27, GOV-F23, A2A-F21 (+`HERMES_MANAGED_DIR` in tests). 20. One plugin `nv-fleet-gates`, phases order the criteria — applied (P3 ships it, P4 enables sandbox, P5 adds wiring). 21. Keep the docker backend, shrink CRED-F28 — applied. 22. Webhook routes on the default profile — applied to LOOP-F40, CH-F52, RT-F01. 23. `llm_execution` middleware fails open on raise — applied (refuse-by-return + ESTOP + negative test). 24. Prune pin must include the default profile — applied to MEM-F44, OPS-F58.a, OBS-F46. 25. `container_boot` = one gateway per profile — applied to OPS-F58.a, ISO-F17. 26. Nothing made a rendered profile a bot — applied (`ui_meta`, Bot Chat title, RPC CAS) to LOOP-F35, SELF-F56. 39. `terminal_scope.py` is main-only at the pin — applied to ISO-F15 (+ ISO-F10 consequence). 40. RT-F07 callable surface — applied. 41. `profile install --ref` does not exist — applied to SELF-F55. 42. Same for SELF-F57 + `--force-config` — applied. 43. MEM-F43 enforcement is host-side — applied. 44. GOV-F27 per-profile pinning — applied.

**should-fix (23/23 applied)**
7. SELF-F56 → MERGE→LOOP-F35 — applied. 8. Merge the artifact-keyed plugins — applied (see deviation D3). 9. No webhook hook; kanban hook names — applied to OBS-F48, GOV-F25. 10. Codex misses both cost seams — applied. 11. Panel has no `send_exec_approval` — applied (subsumed by f32's approval-gate routing, text path kept primary). 12. OPS-F58 criterion is not enforcement — applied. 13. Unattended deny wedges the fixer / gated edges — applied to GOV-F23, A2A-F19 (mechanism taken from f27/f45: `command_allowlist`). 14. SecretSource is startup-time and refresh-free — applied. 15. MCP runs host-side; attribution unassigned — applied to ISO-F10, GOV-F27, ISO-F14. 16. Workspace path must be outside `$HERMES_HOME` — applied. 27. Kanban workers are `single_query_mode` — applied. 28. Rooms are not a rendered surface — applied to A2A-F18, RT-F02, CH-F51, OBS-F45, RT-F01. 29. GOV-F24 write gate mechanisms — applied. 30. `HERMES_DUMP_REQUESTS` must be process-level — applied. 31. `execute_code` bypass — applied to LOOP-F37 and GOV-F25. 32. Route the cost decision through the approval gate; own `operators` setting — applied. 33. `skill_manage` writes host-side — applied. 34. Kanban worker cwd mount — applied. 35. OTLP event set is closed — applied (gauge assertion dropped). 36. `post_api_request` is fired inside `try/except: pass` — applied (native rows authoritative). 45. Three unattended contexts — applied. 46. Dump toggle + artifact location — applied. 47. `ui_meta` is not distribution-owned — applied. 48. Session-mode granularity/semantics — applied. 49. `session:start` is not a VALID_HOOKS name — applied to RT-F09 (+ COST-F30, OBS-F48, GOV-F25 wording). 50. Per-route `toolsets` is coarse — applied. 51. ISO-F14 scope statement — applied.

**nit (10/10 applied — all trivial)**
17. `delegate_task` has no profile arg — applied. 18. `hooks` is not a plugin kind → `kind: standalone` — applied to every BUILD note. 19. `kanban.stranded_threshold_seconds` does not exist — applied to LOOP-F39, LOOP-F38. 37. Drop peering config/gate while CH-F53 is deferred — applied to A2A-F21, A2A-F18. 38. Non-reproducible acceptance hints — applied to CH-F52 (hermetic + optional live) and RT-F07 (platform-agnostic). 52. `cron.failure_nudge_threshold` over-cite — applied. 53. Room-admin api_server routes do exist — applied.

**Skipped: none.** No finding contradicted the brief or the baseline.

## Deviations (applied, but not literally as written)

- **D1 — plugin name and ADR owner.** f1 names the collapsed veto plugin `nv-fleet-guard` and puts its ADR on ISO-F10 "(the earliest phase, P4)"; f20 names it `nv-fleet-gates` and re-phases the work so the plugin ships in **P3-waveA** with the critique/plan/fleet-admin predicates, the sandbox predicate arriving inert until P4. Those two are inconsistent about which row is earliest. Resolved in favour of f20 (the later, more specific finding): the plugin is `nv-fleet-gates`, the ADR sits on **LOOP-F37 (P3-waveA)**, and ISO-F10, GOV-F26, A2A-F18, A2A-F19, GOV-F22, CH-F51 and LOOP-F38 are `MERGE→LOOP-F37` criteria. Both findings' substance (one plugin, one callback, ordered chain, blocks before approves, one conformance test) is intact.
- **D2 — allow surface for unattended work.** f13 proposes the permanent allowlist (`save_permanent_allowlist`); f27 and f45 propose `command_allowlist` (checked before detection) and explicitly say "never `approve`". Rendered as `command_allowlist` per role plus the `approvals.deny[]` floor — the later findings' mechanism, same intent.
- **D3 — GOV-F24 stays its own plugin.** f8's primary recommendation merges GOV-F25 + OBS-F48 + GOV-F24 into `nv-artifact`, with an explicit escape hatch: "if GOV-F24 must stay its own plugin for review-surface reasons, say so explicitly and give it the same single webhook subscription." Taken, and stated in the row: the ledger's append-only / first-write-wins / provenance discipline is the artefact a reviewer audits in isolation, and f29 (a later finding) also specifies `plugins.entries.nv-approval-ledger.writers` as its own settings key. OBS-F48 merges into GOV-F25; GOV-F24 remains BUILD and shares `nv-artifact`'s single `pre_gateway_dispatch` webhook observation seam rather than adding a second one.
