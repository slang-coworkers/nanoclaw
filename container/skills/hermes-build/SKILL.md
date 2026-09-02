---
name: hermes-build
description: "Set up, test, and validate Hermes Agent (v0.21.0, release v2026.8.31). Use when a fork worktree needs its uv venv, when running scripts/run_tests.sh or `hermes plugins doctor --ci`, or when a test or CI run fails."
provides: [code.build, test.run, test.gen, ci.inspect]
allowed-tools: Bash(git:*), Bash(uv:*), Bash(scripts/run_tests.sh:*), Bash(hermes:*), Bash(ruff:*), Bash(gh run:*), Bash(gh api:*), Agent, Read, Grep, Glob
---

# Hermes Build & Test

Hermes is pure Python (`>=3.11,<3.14`, pyproject.toml:15) — there is no compile step. "Build" means: sync the uv venv into the worktree, then run the hermetic test runner and the plugin doctor. The pinned release tree is read-only and is the citation source; everything executable happens in the fork worktree.

| What | Where |
|---|---|
| Release tree (RO — cite `file:line` from here, never build here) | `/workspace/extra/hermes-release` |
| Fork checkout | `/workspace/agent/hermes-agent` |
| Per-target worktree (venv, tests, doctor run here) | `/workspace/agent/wt-<target_slug>` |
| `HERMES_HOME` for `hermes` CLI smoke runs only | `/workspace/agent/.hermes-testbed` |
| Build/test logs | `/workspace/agent/build/<target_slug>-*.log` |

## 1. Environment (once per worktree) — delegate to `Agent`

`uv` is preinstalled. Never `uv python install` (fetches an interpreter over the network); pin the system interpreter. Run `uv sync` OUTSIDE `scripts/run_tests.sh` (it `exec env -i`s and strips proxy/CA env, run_tests.sh:169-183) and inside an `Agent` subagent, never inline (base rule: builds/installs go to `Agent`; never `run_in_background`).

```
Agent(prompt="cd /workspace/agent/wt-<target_slug> && uv sync --locked --python /usr/bin/python3 --extra dev > /workspace/agent/build/<target_slug>-uv-sync.log 2>&1; then .venv/bin/python -c 'import pytest, hermes_cli' && echo VENV_OK. Report: success/fail, last 20 log lines on failure, log path.")
```

- `--locked` refuses to rewrite `uv.lock`. If it fails on a lock mismatch you changed deps: run `uv lock` deliberately and commit the lockfile (pinning policy AGENTS.md:598-618; CI `uv-lockfile-check.yml`).
- CI's full form: `uv sync --locked --python 3.11 --extra all --extra dev --extra anthropic --extra mistral --extra fal --extra modal --extra daytona --extra hindsight --extra parallel-web` (tests.yml:83). Add only the extras your plugin's tests import — the hermetic env forbids mid-run pip installs (`HERMES_DISABLE_LAZY_INSTALLS=1`, conftest.py:545).
- Runner venv probe: `.venv` → `venv` → `~/.hermes/hermes-agent/venv`, and the candidate must have `pytest` importable (run_tests.sh:54-75). Keep the venv at `<worktree>/.venv`.

## 2. Tests — always `scripts/run_tests.sh`, never bare pytest

```bash
cd /workspace/agent/wt-<target_slug>
scripts/run_tests.sh tests/plugins/test_<plugin>.py                 # one file
scripts/run_tests.sh tests/hermes_cli/test_plugin_dev.py -k doctor  # file + -k (runner is file-granular)
scripts/run_tests.sh tests/plugins/ tests/hermes_cli/               # directories
scripts/run_tests.sh -j 4 tests/gateway/ -q --tb=long               # cap parallelism; bare pytest flags pass through
```

What the runner does (run_tests.sh:1-33, 169-183; AGENTS.md:1580-1601):
- One `python -m pytest <file>` subprocess per file (`scripts/run_tests_parallel.py`), no xdist. Workers default to `os.cpu_count()` (`-j`, `HERMES_TEST_WORKERS`). Default discovery skips `tests/integration`, `tests/e2e`, `tests/docker` (`_SKIP_PARTS`, run_tests_parallel.py:78) unless you name them.
- `exec env -i` forwards only PATH, HOME, `HERMES_TEST_*` knobs, TZ=UTC, LANG/LC_ALL=C.UTF-8, PYTHONHASHSEED=0, PYTHONUTF8=1. Proxy vars, HERMES_HOME, API keys are all gone. Tests cannot depend on env.
- Per-file timeout 300 s (`--file-timeout` / `HERMES_TEST_FILE_TIMEOUT`, run_tests_parallel.py:91); one auto-retry per file (`--file-retries`, default 1; `HERMES_TEST_FILE_RETRIES=0` disables). Pass-on-retry is printed as `⚠ FLAKY` — a bug to fix, never "noise".
- `tests/conftest.py` sandboxes HERMES_HOME before any import (40-93) and per test (`_hermetic_environment`, 454-560): credential vars scrubbed, plugin singleton reset. Tests never touch `~/.hermes`; you do not need to set HERMES_HOME for pytest.

### Long runs: chunk inside an `Agent`, explicit Bash timeout per chunk

The container heartbeat only ticks on SDK events, so a silent multi-minute inline run can be killed. Run the suite chunked by top-level directory (`ls -d tests/*/`, plus root-level `tests/test_*.py`) inside an `Agent`; each chunk is its own Bash call with `timeout` declared (e.g. `1500000` ms) and logs to a file. CI reference: 96 cores, ~126 s whole suite, slowest file ~82 s, 30-min job cap (tests.yml:21-25, 104-122) — a small container is many times slower.

```
Agent(prompt="In /workspace/agent/wt-<target_slug>, run these as SEPARATE Bash calls, each with timeout=1500000: `scripts/run_tests.sh tests/plugins -q > /workspace/agent/build/<target_slug>-plugins.log 2>&1`; same for tests/hermes_cli, tests/agent, tests/gateway, tests/tools, then each remaining tests/<dir>/ and finally `scripts/run_tests.sh tests/test_*.py -q`. Report per chunk: exit code, FLAKY files, first failing test ids, log path.")
```

## 3. Plugin validation — `hermes plugins doctor <dir> --ci`

```bash
cd /workspace/agent/wt-<target_slug>
.venv/bin/hermes plugins doctor plugins/<name> --ci                       # exit 1 iff an error-level finding
mkdir -p /workspace/agent/.hermes-testbed
HERMES_HOME=/workspace/agent/.hermes-testbed HERMES_PLUGINS_DEBUG=1 .venv/bin/hermes plugins list   # resolved key/name/kind/source, skip reasons
```

Doctor loads the plugin through the REAL scanner and `register(ctx)` under a temp HERMES_HOME with `HERMES_BUNDLED_PLUGINS=<empty>`, `HERMES_ENABLE_PROJECT_PLUGINS=0`, and socket connects patched to raise (plugin_dev.py:36-77). Errors: non-list `provides_hooks`/`provides_tools`, hook not in `VALID_HOOKS`, callback without `**kwargs`, load failure; warnings: declared-vs-registered drift, v2 manifest checks (plugin_dev.py:358-420). `--ci` raises `SystemExit(1)` only when `report.ok` is false (plugins_cmd.py:3051-3060). Success line: `OK: runtime discovery, manifest parsing, import, and registration passed`. Doctor is not a sandbox — plugin code runs in-process.

`hermes` CLI smoke runs (`plugins install/enable`, `serve`) need a writable home: `export HERMES_HOME=/workspace/agent/.hermes-testbed`. Enable the plugin there with `hermes plugins enable <key>` or write `config.yaml` `plugins: {enabled: [<key>]}` — nothing is enabled by default (plugins.py:649-670).

## 4. Lint (blocking in CI)

`ruff check .` is a blocking job (lint.yml:1-9; `[tool.ruff]` uses `preview = true`, pyproject.toml:624-660). Rules: PLW1514 — explicit `encoding=` on text I/O; ASYNC210/220/221/251 — no blocking HTTP/subprocess/sleep inside `async def`. `plugins/**` is exempt only from PLW1514; ASYNC applies in full. `ty` is advisory. Also `python3 scripts/check-windows-footguns.py` before a PR.

## 5. Writing tests (test.gen)

- Plugin acceptance test at `tests/plugins/test_<plugin>.py`, in the shape of `tests/hermes_cli/test_plugin_api_compat.py:14-52`: copy the plugin into `tmp_path/hermes-home/plugins/<key>`, write `config.yaml` `{plugins: {enabled: [<key>]}}`, point `HERMES_BUNDLED_PLUGINS` at an EMPTY dir, `monkeypatch.setenv` HOME + HERMES_HOME, then `PluginManager().discover_and_load()`; assert `loaded.enabled is True`, `loaded.error is None`, `"<hook>" in loaded.hooks_registered`, and `manager.invoke_hook(...)` results (pass an extra `future_additive_field=` kwarg to prove `**kwargs` tolerance). Empty bundled dir proves the plugin works on a stock tree.
- Doctor-behaviour tests: `tests/hermes_cli/test_plugin_dev.py:28-62` (write a bad plugin → `doctor_plugin(p).ok is False`, message substrings `unknown hook`, `must accept **kwargs`). Parser tests import `build_plugins_parser` from `hermes_cli.subcommands.plugins`.
- Behaviour contracts only: no change-detector assertions (model lists, config version literals, counts) and never read source text in a test (AGENTS.md:1683-1785). OS gating via `@pytest.mark.linux_only/macos_only/windows_only`, never bare `skipif` (AGENTS.md:1629-1681). Tests about `.ts`/`package.json` belong in the vitest suite, not `tests/*.py`.

## 6. CI inspection (ci.inspect)

```bash
gh run list --repo <fork-owner>/hermes-agent --branch plugin/<name> --limit 5
gh run view <run-id> --repo <fork-owner>/hermes-agent --log-failed
```

`.github/workflows/ci.yaml` is an orchestrator: a `detect` classifier fans out to `tests.yml` (Python tests, `scripts/run_tests.sh`, `HERMES_TEST_WORKERS: 96`), `lint.yml`, `tests-os.yml`, `js-tests.yml`, `docs-site-checks.yml`, `uv-lockfile-check.yml`, `supply-chain-audit.yml` and more (ci.yaml:38-182). A plugin PR normally triggers Python tests + lint, plus Docs Site if `website/` changed. Read `--log-failed` for the `FAILED tests/...::test_...` lines and any `⚠ FLAKY` section; reproduce with `scripts/run_tests.sh <that file>` before touching code.

## Gotchas

- `uv sync` after `env -i` (or inside the runner) has no proxy env and fails — sync first, test second.
- `import model_tools` is the only implicit `discover_plugins()` trigger (AGENTS.md:794-798); code paths that read plugin state without it must call `discover_plugins()` explicitly.
- Flat layouts key on the manifest `name`; category layouts key `<cat>/<name>`; depth is capped at 2 (plugins.py:4658-4667). "Plugin not found" is usually a key mismatch or a missing `plugins.enabled` entry — `HERMES_PLUGINS_DEBUG=1 hermes plugins list` shows why.
- `plugins/platforms/*` is scanned flat one level down (plugins.py:4557-4568); memory providers / model providers / context engines have separate discovery.
- Official image apt set (Dockerfile:71-74) includes ripgrep, ffmpeg, make, python3-dev, libffi-dev, procps — a test that shells out to one of these fails on a leaner box; report it as an environment gap, do not patch the test.

## From project

- `scripts/run_tests.sh` (usage 16-33, venv probe 54-75, `exec env -i` 169-183); `scripts/run_tests_parallel.py` (skip parts 78, defaults 91 + 100, FLAKY 311-372)
- `AGENTS.md` Testing 1580-1601, hermetic HERMES_HOME 1560-1573, change-detector + source-reading bans 1683-1785, OS gating 1629-1681, pinning 598-618, discovery timing 794-798
- `.github/workflows/tests.yml:21-25, 83, 100-122`; `lint.yml:1-9`; `ci.yaml:38-182`; `pyproject.toml:15, 624-660`
- `hermes_cli/plugin_dev.py:36-77, 152-182, 358-420`; `hermes_cli/plugins_cmd.py:3051-3060`; `hermes_cli/subcommands/plugins.py:161-171`; `hermes_cli/plugins.py:649-670, 4557-4568, 4658-4667`
- `tests/conftest.py:40-93, 454-560`; `tests/hermes_cli/test_plugin_api_compat.py`; `tests/hermes_cli/test_plugin_dev.py`; `Dockerfile:71-74`
