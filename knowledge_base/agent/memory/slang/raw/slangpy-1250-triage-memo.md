---
type: triage
title: "slangpy#1250 — CI pyright step red: nodeenv 1.10.0 cannot parse nodejs.org v27.0.0-alpha.0.0.0"
description: "CI regression, P1, CI/build-system. Self-hosted nvrgfx-kernelvm-bridge runners have no node and a persistent toolcache with nodeenv 1.10.0, so pyright-python falls back to nodeenv, which takes index.json[0] = 27.0.0-alpha.0.0.0 and crashes in parse_version. Hits ci-latest-slang AND slangpy's own ci.yml (run 40960250198). Fix: requirements-dev.txt pyright -> pyright[nodejs] (recommended) or nodeenv>=1.11.1; both verified locally."
tags: [ci, pyright, nodeenv, nodejs, self-hosted-runner, toolcache, ci-latest-slang, requirements-dev, external-index]
resource: https://github.com/shader-slang/slangpy/issues/1250
---

# Triage: shader-slang/slangpy#1250 — CI pyright step fails (nodeenv vs v27.0.0-alpha index entry)
Date: 2026-10-30T00:25Z | regression (env-induced) | high | P1 | CI / build-system | cross-backend (Linux + Windows self-hosted) | Upstream-Slang: no
Filed by nv-slang-bot[bot] 2026-10-30 00:02Z; no labels, no comments at triage time. No duplicates.

## What's broken
`python tools/ci.py typing-check-python` (`tools/ci.py:236`, bare `pyright`) fails on every self-hosted
Linux/Windows job since nodejs.org published `v27.0.0-alpha.0.0.0` (2026-10-29, first index.json entry;
between 21:53:13Z and 21:54:22Z judging by job timestamps).

## Root cause (facts, verified by reading code + local repro)
1. pyright-python `node.py::_resolve_strategy`: nodejs_wheel (if `nodejs_wheel` importable) → global `node` on PATH → nodeenv.
2. Self-hosted `nvrgfx-kernelvm-bridge` runners: no node on PATH, and the `_work/_tool/Python/3.10.x` toolcache
   persists between jobs → `pip install -r requirements-dev.txt` says "Requirement already satisfied" for
   `pyright` (1.1.411) and `nodeenv` (1.10.0, transitive via pre-commit + pyright, unpinned).
3. nodeenv 1.10.0 with default `--node latest` → `get_last_stable_node_version()` = first index entry, no prerelease
   filter → `get_root_url` → `parse_version('27.0.0-alpha.0.0.0')` splits on '.' → `int('0-alpha')` ValueError.
4. nodeenv **1.11.1** (PyPI 2026-10-29 20:54Z) fixes both: `_is_prerelease` filter + `re.split('[+-]', ...)`.
   Runners never pick it up because the installed 1.10.0 still satisfies the unpinned constraint.
- GitHub-hosted runners (ubuntu-24.04*, macos-latest) have global node → unaffected (macOS job at 21:59Z passed).

## Blast radius
- `ci-latest-slang.yml` → composite `.github/actions/build-and-test-with-slang/action.yml:55` (pip) / `:134` (pyright).
- **slangpy's own `ci.yml:158`/`:210`** — same self-hosted runners. Already hit: run 40960250198 (PR
  codex/accept-existential-box-reflection-name, 21:44Z) failed only `build (windows, msvc, Release)` "Typing Checks"
  with the identical traceback. No ci.yml run since; every future PR/push will be red on self-hosted jobs.
- `ci-gcp.yml:107/158` (workflow_dispatch only): same pip+pyright path; likely affected (hypothesis, not observed).
- pre-commit has no node hooks; sanitizers.yml installs requirements-dev but doesn't run pyright.

## Repro (this container has node in /usr/local/bin — strip it)
```
python3 -m venv /tmp/v && /tmp/v/bin/pip install pyright==1.1.411 nodeenv==1.10.0
export XDG_CACHE_HOME=$(mktemp -d)
NOPATH=$(echo "$PATH" | tr ':' '\n' | grep -vx /usr/local/bin | paste -sd:)
PATH=/tmp/v/bin:$NOPATH pyright --version   # → ValueError '0-alpha' → RuntimeError nodeenv failed
```

## Candidate approaches (all verified in scratch venvs, no global node, fresh cache)
### A: `pyright` → `pyright[nodejs]` in requirements-dev.txt (RECOMMENDED)
- Where: `requirements-dev.txt:7`
- Delta: pip adds `nodejs-wheel-binaries` (24.19.0; wheels for linux x64/aarch64 glibc+musl, win x64/arm64, macOS)
  even when pyright is already installed (verified: simulated runner state → "Successfully installed
  nodejs-wheel-binaries-24.19.0" → pyright runs via nodejs_wheel strategy). No runtime fetch of nodejs.org index.
- Tradeoffs: removes the whole failure class (mutable third-party index, per-job node download on fresh HOME);
  pyright's own recommended path. Cost: one dev-only dep (extra of an existing dep); local devs use wheel node
  instead of their global node (harmless). No workflow-file edit → avoids protected-path approver abstain.
- Risk: low; Node 24 >> pyright's minimum.
### B: add `nodeenv>=1.11.1` to requirements-dev.txt
- Delta: unsatisfied floor forces pip to upgrade the runner's 1.10.0 (verified) → picks 26.13.0.
- Tradeoffs: smallest semantic change; still downloads node from nodejs.org each job and stays exposed to the next
  index-format surprise. Also changes pre-commit's nodeenv (unused).
- Risk: low.
### C: `PYRIGHT_PYTHON_NODE_VERSION=lts` (env in ci.py or workflows)
- Works with 1.10.0 (verified), but pyright-python then passes `--force` and reinstalls node on *every* invocation
  (`_ensure_node_env`: `path.exists() and not NODE_VERSION`), and `lts` still resolves via the index. Not recommended.
### D: `actions/setup-node` in ci.yml / action.yml / ci-gcp.yml
- 3 workflow edits, protected paths (approver ABSTAIN_POLICY), Windows self-hosted setup-node toolcache quirks. Heavier than A/B.

## Recommended path
A (one line). B is an acceptable alternative (or belt-and-braces with A). **Must merge to slangpy main**:
`ci-latest-slang.yml` checks out slangpy's default branch (no `ref:`), so a draft/open PR does not turn the
Slang-side "SlangPy Tests" check green. After merge: re-dispatch ci-latest-slang / rerun failed Slang PR checks.

## Acceptance criteria
1. requirements-dev.txt change only (+ nothing in workflows).
2. Repro venv (pyright 1.1.411 + nodeenv 1.10.0 preinstalled, no node on PATH) → `pip install -r requirements-dev.txt`
   → `python tools/ci.py typing-check-python` exits 0 (with `PYRIGHT_PYTHON_DEBUG=1` showing nodejs_wheel strategy for A).
3. PR's ci.yml self-hosted Linux + Windows "Typing Checks (Python)" green; log shows nodejs-wheel-binaries installed.
4. After merge, one ci-latest-slang run green on the pyright step.

## Sources
- Job logs: ci-latest-slang 40964191769 job 123764447268 (Linux, toolcache 3.10.20, nodeenv 1.10.0); ci.yml 40960250198 job 123750845023 (Windows).
- nodeenv 1.10.0 vs 1.11.1 diff read locally (parse_version, _get_last_node_version).
- DeepWiki RobertCraigie/pyright-python: strategy order wheel → global → nodeenv; `pyright[nodejs]` recommended for CI; NODE_VERSION forces reinstall.
- DeepWiki shader-slang/slangpy: ci.yml and composite action share the same pip + typing-check steps; self-hosted = no pip cache.
- Shared learning: ci-latest-slang always builds slangpy default branch (wiki/concepts/slangpy-ci-triage.md).
