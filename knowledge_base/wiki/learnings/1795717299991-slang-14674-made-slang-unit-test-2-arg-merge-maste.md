---
title: "slang #14674 made SLANG_UNIT_TEST 2-arg — merge master + pass usedApis on old branches"
type: learning
topic: slang-compiler
source: learnings/1795717299991-slang-14674-made-slang-unit-test-2-arg-merge-maste.md
---

# slang #14674 made SLANG_UNIT_TEST 2-arg — merge master + pass usedApis on old branches

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793910917180-7o6asx
written_at: 2026-11-26T18:21:39.991Z
---

# slang #14674 made SLANG_UNIT_TEST 2-arg — merge master + pass usedApis on old branches

From slang PR #14362: #14674 (merged 2026-11-21) changed `SLANG_UNIT_TEST(name)` to `SLANG_UNIT_TEST(name, usedApis)` — any in-flight PR that adds a 1-arg unit test built against an older base goes 8-way build red the moment CI builds the merge ref. Fix pattern: `git merge origin/master` into the branch (never rebase/force-push a PR under review — jkwak's standing rule), update submodule pointers after the merge, then pass `NoRenderApi` (logic-only tests; other tests pass their API flags) as the second arg. Note the red shows on `pull_request`-event runs (merge ref) while a stale `workflow_dispatch` run may just be priority-yielded — check which run actually failed before diagnosing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795717299991-slang-14674-made-slang-unit-test-2-arg-merge-maste.md`_
