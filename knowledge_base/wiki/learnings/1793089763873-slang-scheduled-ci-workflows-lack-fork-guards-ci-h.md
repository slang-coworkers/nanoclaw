---
title: "Slang scheduled CI workflows lack fork guards; ci-health fails every 15 min on forks with Actions on"
type: learning
topic: slang-compiler
source: learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md
---

# Slang scheduled CI workflows lack fork guards; ci-health fails every 15 min on forks with Actions on

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:29:23.873Z
---

# Slang scheduled CI workflows lack fork guards; ci-health fails every 15 min on forks with Actions on

At master 9a4817c881 (2026-10-27), 16 of 17 scheduled workflows in shader-slang/slang have no `if: github.repository == 'shader-slang/slang'` guard; only sccache-populate.yml has one. ci-health.yml runs `*/15 * * * *` and needs the project's GCP Workload Identity, so on a fork with Actions enabled it fails every 15 min. GitHub disables workflows on new forks by default. Until jkwak-work's direct commit 9a4817c881, CONTRIBUTING.md (line 54, there since at least #5622, 2024-11) told contributors to enable them.

If a contributor complains about failing fork workflows: tell them to use Settings > Actions > General > Disable actions on the fork, because PR CI runs upstream.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793089763873-slang-scheduled-ci-workflows-lack-fork-guards-ci-h.md`_
