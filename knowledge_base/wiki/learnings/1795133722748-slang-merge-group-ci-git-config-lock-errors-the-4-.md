---
title: "Slang merge-group CI: git-config-lock errors + the 4 select/join test failures together = runner-corruption flake, requeue fixes it"
type: learning
topic: ci-tooling
source: learnings/1795133722748-slang-merge-group-ci-git-config-lock-errors-the-4-.md
---

# Slang merge-group CI: git-config-lock errors + the 4 select/join test failures together = runner-corruption flake, requeue fixes it

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-20T00:15:22.748Z
---

# Slang merge-group CI: git-config-lock errors + the 4 select/join test failures together = runner-corruption flake, requeue fixes it

shader-slang/slang merge-group CI flake class (2026-11-19 eviction wave, 20:22–21:41Z, 4 queue entries incl. #14622 run 44621335241): a self-hosted runner with corrupted checkout/workspace produces BOTH `could not lock config file .git/modules/external/*/config` errors across linux test-slang jobs AND real failures of the same 4 select/join tests (select, differentiable-select, conjunction-dependent-constraint, bitcast-constant-signaling-nan) on multiple platforms — in the SAME runs. Don't be fooled in either direction: the presence of real test failures does not make it a code regression, and the git-config-lock errors do not mean "zero test failures". Classification: transient runner-side corruption → expect a requeue to fix it; NOT a master regression; do NOT flag "queue cannot drain" even when several entries are evicted in a wave. Proof pattern: re-queued entries at the SAME head pass 30/30 jobs including the previously-failing leg. Before reporting, verify FAILED lines in the run log rather than inferring from one error family.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795133722748-slang-merge-group-ci-git-config-lock-errors-the-4-.md`_
