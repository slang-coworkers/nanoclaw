---
name: hermes-code-writer
description: "Implement changes in Hermes Agent as plugins. Scaffold plugin.yaml + register(ctx) in the fork worktree, write behaviour tests, lint, commit. Core edits only behind a CORE-CHANGE ADR section."
provides: [code.read, code.edit, test.gen]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Hermes Code Writer

## The plugin-first rule (non-negotiable)

Every capability is a Hermes PLUGIN: a native directory plugin (`plugin.yaml` with `manifest_version: 1` + `__init__.py` exposing `register(ctx)`) or a portable Agent Plugins v1 package (`plugin.json` + `skills/<name>/SKILL.md`, optional `mcp.json`, no Python — index.md:45-105). Writable paths: `plugins/**`, `website/docs/**`, `tests/**`. Any edit outside those requires a section titled `CORE-CHANGE` in the ADR (`/workspace/agent/reports/<target_slug>.md`) citing the exact `/workspace/extra/hermes-release/<file>:<line>` that blocks a plugin — and even then you widen the generic plugin surface (new hook, new ctx method), never special-case a plugin in core (AGENTS.md:123-125, 851-857). The reviewer must-changes any diff outside those paths without that section. Third-party-product plugins do not land under `plugins/` upstream (AGENTS.md:126-137); in the fork they may — say so in the ADR.

Footprint ladder (AGENTS.md:24-27, 183-212): extend existing code → CLI command + skill → `check_fn`-gated tool → plugin → MCP server → new core tool last. Pick the highest rung that solves it and write down why.

## Where you work

- Fork checkout `/workspace/agent/hermes-agent`; one worktree per target: `git worktree add /workspace/agent/wt-<target_slug> -b plugin/<name>`. Never edit the main checkout or sibling `wt-*` dirs.
- Release tree `/workspace/extra/hermes-release` is read-only: read and cite, never write.
- The plugin lives at `plugins/<name>/` (bundled shape), or — to prove out-of-tree installability — a standalone dir copied into `$HERMES_HOME/plugins/<name>/` with `HERMES_HOME=/workspace/agent/.hermes-testbed`.

## Native plugin skeleton (v1 manifest)

`plugins/<name>/plugin.yaml`

```yaml
manifest_version: 1              # explicit v1; absent also means v1 (plugins.py:754-755)
name: <name>                     # flat layouts key on this name (plugins.py:4658-4667)
version: 0.1.0
description: One line — what it adds.
provides_tools: [<tool_name>]    # must be lists (doctor errors otherwise)
provides_hooks: [pre_tool_call]  # every entry must be in VALID_HOOKS (plugins.py:163-389)
# optional: author, kind: platform (gateway adapters), requires_env / optional_env,
# capabilities: [tools.override, llm.model_override], hooks: {<alias>: ...}
```

`plugins/<name>/__init__.py`

```python
"""<name> plugin — registration."""
import json
import logging

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {"name": "<tool_name>", "description": "...",
               "parameters": {"type": "object", "properties": {}, "required": []}}


def _handle(args: dict, **kwargs) -> str:            # JSON string out, never raises (index.md:467-472)
    try:
        return json.dumps({"ok": True})
    except Exception as exc:                          # tool boundary — broad catch is correct here
        logger.warning("<tool_name> failed", exc_info=True)
        return json.dumps({"error": str(exc)})


def _pre_tool_call(tool_name, args, task_id=None, **kwargs):   # **kwargs mandatory (doctor error otherwise)
    return None                                       # or {"action": "block", "message": "..."}


def register(ctx):
    ctx.register_tool(name="<tool_name>", toolset="<name>", schema=TOOL_SCHEMA, handler=_handle)
    ctx.register_hook("pre_tool_call", _pre_tool_call)
```

Other `register(ctx)` surfaces (hermes_cli/plugins.py): `register_middleware(kind, cb)` 3567 — kinds `tool_request | llm_request | tool_execution | llm_execution`, request kinds return `{"args": ...}`/`{"request": ...}` or `None`, execution kinds call `next_call(payload)` exactly once (index.md:1064-1100); `register_command` 2179 (in-session slash); `register_cli_command` 2139; `register_platform` 2928 (`kind: platform`); `register_system_prompt_section` 3412; `register_skill` 3597; `register_terminal_environment_provider` 2670; `register_secret_source` 2735; `register_approval_transport` 1740. Context helpers: `ctx.get_config/set_config` (`plugins.entries.<id>.settings`), `ctx.state`, `ctx.dispatch_tool`, `ctx.has_capability`, `ctx.has_plugin`. Durable state via `plugins.plugin_storage.plugin_data_dir(name)` → `<HERMES_HOME>/plugin-data/<name>/`; never write into the plugin dir (index.md:665-685). Tool override needs `override=True` plus an operator grant, else the plugin is disabled (index.md:855-910). Nothing is enabled by default: `plugins.enabled: [<key>]` in config.yaml or `hermes plugins enable <key>`.

## Style (AGENTS.md / CONTRIBUTING.md)

- PEP 8, loose line length; comments only for non-obvious why; catch specific exceptions; `logger.warning/error(..., exc_info=True)` (CONTRIBUTING.md:331-336).
- ruff (blocking): `encoding=` on every text open — PLW1514, from which `plugins/**` and `tests/**` are exempt; no blocking `requests`/`subprocess`/`time.sleep` inside `async def` — ASYNC210/220/221/251, applies to plugins in full (pyproject.toml:652-660). Run `ruff check plugins/<name> tests/plugins/` before every commit.
- Hook callbacks accept `**kwargs`; handlers are `def h(args: dict, **kwargs) -> str` returning JSON, never raising.
- Paths: `get_hermes_home()` / `display_hermes_home()` from `hermes_constants`, never `~/.hermes` or `Path.home()/".hermes"` (AGENTS.md:1385-1410). Settings: `config.yaml` (plugin side `ctx.get_config`); never a new `HERMES_*` env var for non-secret config (AGENTS.md:102-108).
- Deps: exact pins in core; v2 `python_dependencies` are declare-only and never auto-installed (pin upper bounds); git URLs by 40-char SHA; `uv lock` after any change (AGENTS.md:598-618).
- Cross-platform: `shutil.which` before shelling out, `psutil.pid_exists` not `os.kill(pid, 0)`, pathlib, guard `os.setsid`/`fork`/POSIX signals; run `python3 scripts/check-windows-footguns.py` (CONTRIBUTING.md:676-846). Security: `shlex.quote` user input, `os.path.realpath` before path checks, never log secrets (849-873).
- Prompt caching is sacred: a hook must never mutate past context, swap toolsets, or rebuild the system prompt mid-conversation (AGENTS.md:19-23).
- No speculative hooks/extension points without a concrete consumer (AGENTS.md:98-102).

## Tests you write (test.gen)

- Acceptance test at `tests/plugins/test_<name>.py`, shaped like `tests/hermes_cli/test_plugin_api_compat.py:14-52`: isolated `HERMES_HOME` under `tmp_path`, `HERMES_BUNDLED_PLUGINS` → EMPTY dir, `config.yaml` enabling the key, `PluginManager().discover_and_load()`, assert `enabled`, `error is None`, hooks registered, `invoke_hook(...)` results with an extra additive kwarg. Prove it FAILS before the change (own commit), passes after.
- Behaviour contracts, not snapshots; never read source text in a test; no bare `skipif` (AGENTS.md:1629-1785). Tests never write `~/.hermes` — conftest sandboxes HERMES_HOME (AGENTS.md:1560-1573).
- Run only via `scripts/run_tests.sh <file>` (`/hermes-build`).

## Cycle

1. Read the ADR + acceptance test in `/workspace/agent/reports/`; confirm the plugin surface against `website/docs/developer-guide/plugins/index.md`.
2. Scaffold `plugins/<name>/`; `.venv/bin/hermes plugins doctor plugins/<name> --ci` from the worktree.
3. Implement the minimum; `ruff check`; `scripts/run_tests.sh tests/plugins/test_<name>.py`; then `tests/plugins/ tests/hermes_cli/`.
4. Docs page + `website/sidebars.ts` entry when user-facing (`/hermes-docs`).
5. Commit with Conventional Commits `<type>(<scope>): <description>` — `test(plugins): ...` first, then `feat(plugins): ...`, `docs(plugins): ...` (CONTRIBUTING.md:944-969). One logical change per PR. Hand off to `/hermes-github` for the draft PR to the fork.

## From project

- `AGENTS.md:19-27, 98-108, 123-137, 183-212, 549-595, 598-618, 794-824, 851-885, 1385-1410, 1560-1573, 1629-1785`
- `CONTRIBUTING.md:88-102, 331-336, 676-846, 849-873, 944-969`
- `hermes_cli/plugins.py` (VALID_HOOKS 163-389, manifest 715-770, PluginContext 1458 + `register_*` anchors above, layout 4658-4667); `hermes_cli/plugin_dev.py:358-420`; `hermes_cli/middleware.py`; `plugins/plugin_storage.py`
- `website/docs/developer-guide/plugins/index.md` (45-105, 204-256, 276-310, 467-472, 476-510, 665-685, 855-910, 923-951, 1064-1100)
- `tests/hermes_cli/test_plugin_api_compat.py`; `tests/hermes_cli/fixtures/plugin_compat_legacy/`; `plugins/disk-cleanup/`; `plugins/platforms/a2a/plugin.yaml`; `pyproject.toml:624-660`
