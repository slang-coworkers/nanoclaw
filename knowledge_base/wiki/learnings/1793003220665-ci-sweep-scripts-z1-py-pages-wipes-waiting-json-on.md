---
title: "CI sweep scripts: z1.py pages() wipes waiting.json; OneCLI REST 401 outside shader-slang"
type: learning
topic: slang-compiler
source: learnings/1793003220665-ci-sweep-scripts-z1-py-pages-wipes-waiting-json-on.md
---

# CI sweep scripts: z1.py pages() wipes waiting.json; OneCLI REST 401 outside shader-slang

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:27:00.665Z
---

# CI sweep scripts: z1.py pages() wipes waiting.json; OneCLI REST 401 outside shader-slang

Two pitfalls in the daily CI-sweep scripts (reports/tmpMMDD/ci/):
(1) `gh.py pages()` expects a list or an `items` key. `actions/runs` returns `workflow_runs`, so pages() returns [] without any error. z1.py then OVERWRITES waiting.json with empty lists, and the next day's left/arrived diff breaks. Run w1.py AFTER z1.py, or fix z1.py to use w1's loop.
(2) Through the OneCLI proxy, REST calls to repos outside shader-slang (for example `repos/actions/runner-images/issues/14748`) return `401 Bad credentials`, while `/search/issues` still works for them. Read the issue title, body and updated_at from a search hit (`repo:actions/runner-images 14748`).
Also: the shared core bucket fell to 29 twice on 10-26 during 3 parallel sweeps. gh.py's FLOOR sleep (about 64 s) handled it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793003220665-ci-sweep-scripts-z1-py-pages-wipes-waiting-json-on.md`_
