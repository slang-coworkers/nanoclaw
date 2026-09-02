### Hermes public API invariants

Citations are `file:line` relative to the release tree `/workspace/extra/hermes-release` (tag v2026.8.31, v0.21.0).

**Stable surfaces — treat as public API:**

- Directory plugin contract: `plugin.yaml` + `__init__.py` exposing `register(ctx)` (`hermes_cli/plugins.py:19-20`). Manifest v1 fields `name, version, description, provides_tools, provides_hooks` (optional `author, requires_env, optional_env, kind, label, hooks, capabilities`); `manifest_version` absent ⇒ 1 (`plugins.py:754-755`), `SUPPORTED_MANIFEST_VERSION = 2` (`plugins.py:728`); unknown fields warn and still load (`plugins.py:715-725`). v2 adds `requires_plugins`, `python_dependencies` (declare-only, never auto-installed), `config_schema`, `license`, `homepage`, `tags`.
- `PluginContext` (`hermes_cli/plugins.py:1458`): `register_tool`, `register_hook`, `register_command`, `register_cli_command`, `register_platform`, `register_platform_handler`, `register_middleware`, `register_system_prompt_section`, `register_skill`, `register_context_engine`, `register_memory_provider`, `register_terminal_environment_provider`, `register_secret_source`, `register_approval_transport`, `dispatch_tool`, `get_config` / `set_config` (`plugins.entries.<id>.settings`), `state`, `has_capability`, `has_plugin`. Hook names are the `VALID_HOOKS` set (`plugins.py:163-389`); middleware kinds are `tool_request | llm_request | tool_execution | llm_execution` (`hermes_cli/middleware.py`).
- Handler contracts: a tool handler is `def handler(args: dict, **kwargs) -> str`, returns a JSON string, never raises; every hook callback accepts `**kwargs` (doctor reports an error otherwise, `hermes_cli/plugin_dev.py:394-400`).
- Discovery: bundled `plugins/` → `$HERMES_HOME/plugins/` → `./.hermes/plugins/` (only with `HERMES_ENABLE_PROJECT_PLUGINS=1`) → pip entry-point group `hermes_agent.plugins`; later source wins on key collision (`plugins.py:5-17, 4352-4370`). Keys are path-derived — flat layout key = manifest `name`, category layout key = `<cat>/<name>`, depth capped at 2 (`plugins.py:4658-4667`). Plugins are opt-in via `plugins.enabled` in `config.yaml` (`plugins.py:649-670`); `HERMES_BUNDLED_PLUGINS=<dir>` overrides the bundled dir (`plugins.py:83-93`).
- Tool override: `register_tool(..., override=True)` plus the operator grant `plugins.entries.<id>.allow_tool_override: true` for non-bundled plugins, else `PluginToolOverrideError` and the plugin is disabled (`website/docs/developer-guide/plugins/index.md:855-910`).
- Portable Agent Plugins v1: `plugin.json` at package root + `skills/<name>/SKILL.md` [+ `mcp.json`], no Python; installed disabled; skills namespaced `agent-plugin-<slug>-<hash>` (`hermes_cli/agent_plugins.py`; `index.md:45-105`).
- CLI entry points `hermes = hermes_cli.main:main`, `hermes-agent = run_agent:main`, `hermes-acp = acp_adapter.entry:main` (`pyproject.toml:391-394`); `config.yaml` schema = `DEFAULT_CONFIG` in `hermes_cli/config.py`; gateway `BasePlatformAdapter` (`gateway/platforms/base.py`); profiles = separate `HERMES_HOME` (`hermes_cli/main.py` `_apply_profile_override`); distributions = `distribution.yaml` (`website/docs/user-guide/profile-distributions.md:22, 46-54`).

**Backward-compatibility rules — the contract is additive (`website/docs/developer-guide/plugins/index.md:107-163`; `AGENTS.md:800-824`):**

- Never remove or rename a documented `PluginContext` method; new parameters are optional, defaulted, keyword-only; existing return fields are never removed or retyped.
- New hook payload data arrives as keyword fields; callbacks are signature-inspected; never change an existing field's meaning or position.
- Unknown manifest fields are ignored; new provider methods get default implementations; a capability that crosses a wire or persisted boundary versions its own local schema, not a global one.
- Deprecating a documented behavior needs a once-per-process warning naming the replacement, a documented migration, and support through two subsequent minor releases.
- Per-conversation prompt caching is sacred: nothing mutates past context, swaps toolsets, or rebuilds the system prompt mid-conversation (`AGENTS.md:19-23, 1345-1357`).
- No new `HERMES_*` env vars for non-secret config — behavior lives in `config.yaml` (`AGENTS.md:102-108, 647-663`). Paths via `get_hermes_home()` / `display_hermes_home()`, never a hard-coded `~/.hermes` or `Path.home()/'.hermes'` (`AGENTS.md:1385-1410`). Plugin durable state via `plugins.plugin_storage.plugin_data_dir(name)` / `plugin_db(name)`, never inside the plugin dir (`index.md:665-685`).

**Test contract rules:**

- Behavior contracts, not snapshots: no change-detector tests — model lists, config-version literals, enumeration counts (`AGENTS.md:80-84, 1683-1730`). Never read source code in tests; extract the logic and call it (`AGENTS.md:1731-1785`).
- Plugin tests load frozen fixtures through the real discovery path from an isolated `HERMES_HOME` with `HERMES_BUNDLED_PLUGINS` pointed at an empty dir, then assert registration and hook/tool outcomes (`tests/hermes_cli/test_plugin_api_compat.py:14-52`; fixture `tests/hermes_cli/fixtures/plugin_compat_legacy/`).
- Only `scripts/run_tests.sh` runs tests, never bare `pytest` (`AGENTS.md:1580-1601`); tests never write `~/.hermes` — `tests/conftest.py:454-560` sandboxes `HERMES_HOME`, scrubs credential vars, sets `HERMES_DISABLE_LAZY_INSTALLS=1`, resets the plugin singleton. OS gating via `@pytest.mark.linux_only | macos_only | windows_only`, never bare `skipif` (`AGENTS.md:1629-1681`). Assertions about `package.json` / `.ts` / `.tsx` artifacts belong in vitest, not `tests/*.py` (`AGENTS.md:1617-1627`).
- A `FLAKY` (pass-on-retry) report from the runner is a bug to fix, not noise.

**Dependency rules:** core deps exact `==X.Y.Z`; extras and new deps bounded `>=floor,<next_major` (pre-1.0: `<0.(minor+2)`); git URLs by 40-char SHA; run `uv lock` after any `pyproject.toml` change (`AGENTS.md:598-618`; `pyproject.toml:20-40`). `hermes plugins install --ref` takes a full 40-char commit SHA only (`hermes_cli/plugins_cmd.py:591-594`).
