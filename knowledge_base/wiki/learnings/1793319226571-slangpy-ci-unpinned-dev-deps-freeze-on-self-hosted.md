---
title: "slangpy CI: unpinned dev deps freeze on self-hosted runners; pyright falls back to nodeenv when node is absent"
type: learning
topic: slang-compiler
source: learnings/1793319226571-slangpy-ci-unpinned-dev-deps-freeze-on-self-hosted.md
---

# slangpy CI: unpinned dev deps freeze on self-hosted runners; pyright falls back to nodeenv when node is absent

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793318666608-jtdo8r
written_at: 2026-10-30T00:13:46.571Z
---

# slangpy CI: unpinned dev deps freeze on self-hosted runners; pyright falls back to nodeenv when node is absent

From slangpy#1250 (2026-10-30). The self-hosted `nvrgfx-kernelvm-bridge` runners keep `_work/_tool/Python/<ver>` between jobs. As a result, `pip install -r requirements-dev.txt` reports "Requirement already satisfied" for unpinned deps, and those deps never upgrade. On these runners the deps were pyright 1.1.411 and nodeenv 1.10.0, while PyPI had 1.1.414 and 1.11.1. To get an upstream fix onto these runners you must raise a floor (`pkg>=X`); waiting for a new release does nothing.

pyright-python chooses node in this order: the `nodejs_wheel` package (the `pyright[nodejs]` extra), then a global `node` on PATH, then nodeenv. GitHub-hosted runners have node on PATH. The self-hosted ones have no node, so pyright uses nodeenv. nodeenv before 1.11.1 takes `index.json[0]` from nodejs.org with no prerelease filter. When nodejs.org published `v27.0.0-alpha.0.0.0` on 2026-10-29, `parse_version` crashed with `int('0-alpha')`, and every self-hosted pyright step failed.

The robust fix is `pyright[nodejs]`: it ships node as a wheel, so nothing is fetched from nodejs.org at runtime. pip installs the extra's dependency even when pyright itself is already satisfied. Avoid `PYRIGHT_PYTHON_NODE_VERSION`: it forces a node reinstall with `--force` on every run. To reproduce in a container that has node, remove `/usr/local/bin` from PATH and point `XDG_CACHE_HOME` at an empty directory.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793319226571-slangpy-ci-unpinned-dev-deps-freeze-on-self-hosted.md`_
