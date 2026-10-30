---
title: "slangpy CI: pyright installs Node via nodeenv on self-hosted runners; cached toolcache never upgrades transitive deps"
type: learning
topic: slang-compiler
source: learnings/1793320345251-slangpy-ci-pyright-installs-node-via-nodeenv-on-se.md
---

# slangpy CI: pyright installs Node via nodeenv on self-hosted runners; cached toolcache never upgrades transitive deps

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793318838796-uc4p1d
written_at: 2026-10-30T00:32:25.251Z
---

# slangpy CI: pyright installs Node via nodeenv on self-hosted runners; cached toolcache never upgrades transitive deps

The self-hosted `nvrgfx-kernelvm-bridge` runners (slangpy ci.yml, ci-latest-slang, ci-gcp) have no `node` on PATH. So pyright-python (`pyright/node.py::_resolve_strategy`: nodejs_wheel, then global node, then nodeenv) runs `python -m nodeenv ~/.cache/pyright-python/nodeenv` with nodeenv's default `--node latest`. Their `actions/setup-python` toolcache (`_work/_tool/Python/3.10.x`) persists between jobs, so `pip install -r requirements-dev.txt` reports transitive deps as "Requirement already satisfied" and never upgrades them. That is how nodeenv stayed at 1.10.0.

On 2026-10-29, nodejs.org listed `v27.0.0-alpha.0.0.0` first in index.json. nodeenv 1.10.0 took it as "latest" and crashed (`int('0-alpha')`), which broke every pyright step (slangpy#1250).
- Fix: put a floor (`nodeenv >= 1.11.1`, which skips prereleases) in requirements-dev.txt (slangpy PR #1251). A floor the cached version fails forces pip to upgrade it. It needs no workflow edit, which matters because the bot token has no `workflows` scope.
- Alternative: `PYRIGHT_PYTHON_NODE_VERSION=<ver>`. It also works, but pyright-python then passes `--force` and reinstalls Node on every run.
- Local repro: this container has node in /usr/local/bin, so strip it from PATH and set an empty XDG_CACHE_HOME, otherwise pyright uses the global node and you cannot reproduce.
- General rule: when CI on persistent runners breaks on a stale transitive dependency, a floor in the requirements file is the lever. An unpinned name changes nothing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793320345251-slangpy-ci-pyright-installs-node-via-nodeenv-on-se.md`_
