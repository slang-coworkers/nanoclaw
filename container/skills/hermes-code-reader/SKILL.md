---
name: hermes-code-reader
description: "Read-only investigation of Hermes Agent (v0.21.0). Navigate the pinned release tree, trace the plugin system, gateway, and agent loop, and cite file:line evidence from it."
provides: [code.read, doc.read]
allowed-tools: Bash, Read, Grep, Glob, mcp__deepwiki__ask_question
---

# Hermes Code Reader

## Citation rule

The exact release (Hermes v0.21.0, tag `v2026.8.31`) is mounted read-only at `/workspace/extra/hermes-release`. It is the ONLY citation source: every claim in an ADR, review, or report cites `<file>:<line>` in that tree (write the path relative to it once the tree is named). Never cite the fork worktree for "how Hermes works" — it may carry your own edits. DeepWiki (`mcp__deepwiki__ask_question(repoName="NousResearch/hermes-agent", question=...)`) is advisory only: use it to find where to look, then confirm in the tree. When DeepWiki disagrees with the tree, the tree wins and the report flags it: "DeepWiki claims X; release tree shows Y at file:line". A claim you could not confirm in the tree is labelled "unverified (DeepWiki)".

Wide scope → `Agent` subagent that returns a summary with anchors; narrow scope → Read/Grep directly. Reports land in `/workspace/agent/reports/<target_slug>.md`; label facts vs hypotheses.

## Layout

| Path | What |
|---|---|
| `run_agent.py` | `AIAgent` — synchronous conversation loop, tool dispatch, budget/interrupt, session persistence (~12k LOC) |
| `model_tools.py` | tool orchestration; importing it is the ONLY implicit `discover_plugins()` trigger (AGENTS.md:794-798) |
| `toolsets.py` | `TOOLSETS` + `_HERMES_CORE_TOOLS`; a tool reaches the model only if named in a toolset |
| `cli.py`, `hermes_cli/commands.py` | `HermesCLI` (prompt_toolkit) and `COMMAND_REGISTRY` for slash commands |
| `hermes_cli/` | CLI subcommands, setup wizard, `config.py` (DEFAULT_CONFIG, OPTIONAL_ENV_VARS), `main.py` (`hermes` entry; `_apply_profile_override` sets HERMES_HOME), plugin system (table below) |
| `hermes_constants.py`, `hermes_logging.py` | `get_hermes_home()`, `display_hermes_home()`, profile-aware logs |
| `agent/` | prompt_builder, context_compressor, auxiliary_client, memory_manager, `shell_hooks.py` (Claude-Code-compatible shell hook bridge), outbound_webhooks, curator |
| `tools/` | self-registering tools (`registry.register` at import), `approval.py`, `terminal_tool.py`, `delegate_tool.py`, `environments/` (local, docker, ssh, singularity, modal, daytona, vercel_sandbox) |
| `gateway/` | `run.py` GatewayRunner, `session.py`, `platforms/base.py` BasePlatformAdapter, `authz_mixin.py`, `status.py`, `builtin_hooks/` |
| `plugins/` | bundled plugins: `platforms/{a2a,discord,slack,telegram,irc,matrix,...}`, `memory/`, `model-providers/`, `context_engine/`, `image_gen/`, `kanban/`, `observability/`, `disk-cleanup/`, `plugin_storage.py`, `plugin_utils.py` |
| `skills/`, `optional-skills/` | bundled SKILL.md skills by category |
| `cron/`, `tui_gateway/`, `acp_adapter/`, `ui-tui/`, `apps/desktop/`, `web/` | scheduler; JSON-RPC backend behind `hermes --tui` / desktop / `hermes serve`; ACP server; Ink TUI; Electron app (own AGENTS.md); dashboard |
| `tests/` | pytest suite; `conftest.py` hermetic invariants; `hermes_cli/test_plugin*.py`, `plugins/`, `skills/`, `gateway/`, `agent/` |
| `website/docs/` | Docusaurus docs — `developer-guide/plugins/index.md` is the plugin contract |
| `docs/` | internal design notes + `docs/ADR.md` |
| `AGENTS.md`, `CONTRIBUTING.md` | the rules; read the relevant section before proposing anything (layout trees: AGENTS.md:271-308, CONTRIBUTING.md:219-420) |

Entry points: `hermes = hermes_cli.main:main`, `hermes-agent = run_agent:main`, `hermes-acp = acp_adapter.entry:main` (pyproject.toml:391-394).

## Plugin system — anchors in `hermes_cli/plugins.py`

| Question | Anchor |
|---|---|
| Discovery sources + precedence (bundled → user `$HERMES_HOME/plugins` → project `./.hermes/plugins` [HERMES_ENABLE_PROJECT_PLUGINS=1] → pip `hermes_agent.plugins`; later wins) | 5-17, `_collect_directory_manifests` 4541-4590, winners 4352-4370 |
| Layout/key rule (flat `<name>`, category `<cat>/<name>`, depth 2); bundled `platforms/` scan | 4658-4667; 4557-4568 |
| Opt-in: `plugins.enabled` in config.yaml | `_get_enabled_plugins` 649-670 |
| Manifest allow-list; `manifest_version` default 1; `SUPPORTED_MANIFEST_VERSION = 2` | 715-725; 754-770; 728 |
| `VALID_HOOKS` (37 hooks; `pre_verify` 181-191, `pre_gateway_dispatch` 228-235, approval observers 236-251) | 163-389 |
| `PluginContext` and `register_*` | class 1458; `register_tool` 1778; `register_cli_command` 2139; `register_command` 2179; `register_platform` 2928; `register_hook` 3387; `register_system_prompt_section` 3412; `register_middleware` 3567; `register_skill` 3597 |
| `PluginManager` | class 3738; `discover_and_load` 4226; `invoke_hook` 5564 |
| `HERMES_BUNDLED_PLUGINS` override | 83-93 |
| Doctor | `hermes_cli/plugin_dev.py` (`_doctor_runtime` 36-77, `doctor_plugin` 358-420); CLI `hermes_cli/subcommands/plugins.py:161-171`, `plugins_cmd.py:3051-3060, 3121-3175` |
| Portable Agent Plugins v1 | `hermes_cli/agent_plugins.py`; discovery hook `plugins.py:4713` |
| Middleware kinds | `hermes_cli/middleware.py` `VALID_MIDDLEWARE` |
| Shell-hook bridge (config.yaml `hooks:`) | `agent/shell_hooks.py` |

Docs to read alongside: `website/docs/developer-guide/plugins/index.md` (manifest 204-256, v2 276-310, handler contract 467-472, discovery debug 601-628, storage 665-685, tool override 855-910, hook table 923-951, middleware 1064-1100, pip 1660-1668); one `website/docs/developer-guide/*-plugin.md` per provider ABC; `website/docs/user-guide/features/hooks.md`; `website/docs/user-guide/profile-distributions.md`; `docs/ADR.md`.

## Search strategies

```bash
R=/workspace/extra/hermes-release
grep -n "^## \|^### " $R/AGENTS.md                                  # rule index — quote the rule you rely on
grep -n "    def register_" $R/hermes_cli/plugins.py                # every ctx surface with line numbers
grep -rn 'invoke_hook("<hook>"' $R --include=*.py                   # who fires a hook, with what kwargs
grep -rln "def register(ctx)" $R/plugins                            # bundled exemplars (disk-cleanup is smallest; platforms/a2a is kind: platform)
grep -n '"<key>"' $R/hermes_cli/config.py                           # DEFAULT_CONFIG key + default
grep -rln "<symbol>" $R/tests --include=*.py | head                 # behaviour tests = the contract to copy
grep -rn "<phrase>" $R/website/docs --include=*.md -l                # documented behaviour
```

- Verify the premise first: point to the exact line where the behaviour manifests before calling it a bug; respect intentional design (profiles are islands; load-bearing omissions) (AGENTS.md:139-181).
- Gateway questions start at `gateway/platforms/base.py`; tool questions at `tools/registry.py` then the tool file; config at `hermes_cli/config.py`; profile paths at `hermes_constants.py`.
- Prefer `tests/` over implementation guesses for what a subsystem promises.
- Third-party-product integrations are meant to live out of tree (AGENTS.md:126-137) — note this when scoping a plugin's home.

## From project

- `AGENTS.md` (5, 19-27, 123-137, 139-181, 271-308, 794-798, 851-857, 1385-1410); `CONTRIBUTING.md` (21-36 search first, 219-420 layout)
- `hermes_cli/plugins.py` (anchors above), `hermes_cli/plugin_dev.py`, `hermes_cli/agent_plugins.py`, `hermes_cli/middleware.py`, `hermes_cli/config.py`, `agent/shell_hooks.py`
- `website/docs/developer-guide/plugins/index.md`, `website/docs/developer-guide/*-plugin.md`, `website/docs/user-guide/features/hooks.md`, `website/docs/user-guide/profile-distributions.md`, `docs/ADR.md`
- `pyproject.toml:391-394`; `tests/conftest.py`
