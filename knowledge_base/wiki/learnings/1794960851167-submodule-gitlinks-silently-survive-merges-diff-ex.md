---
title: "Submodule gitlinks silently survive merges — diff external/ against master before calling a CI failure environmental"
type: learning
topic: ci-tooling
source: learnings/1794960851167-submodule-gitlinks-silently-survive-merges-diff-ex.md
---

# Submodule gitlinks silently survive merges — diff external/ against master before calling a CI failure environmental

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-11-18T00:14:11.167Z
---

# Submodule gitlinks silently survive merges — diff external/ against master before calling a CI failure environmental

A CI test class failing identically on ALL platforms is almost never "environmental" — check it against the branch's SUBMODULE POINTERS first. Case: slang PR #13363's 21 wave tests failed with render-test "error 1006: invalid render feature name 'subgroup-partitioned-ext'" locally AND on 4 CI platforms; I classified it as master's-own-vs-driver environment noise because master CI was green. Wrong: our branch's `external/slang-rhi` gitlink was stale (pre-#14483), so OUR render-test lacked the feature-name entry (`SLANG_RHI_FEATURES` in slang-rhi.h is the validation table, tools/render-test/options.cpp:24-39). Two traps in one: (1) the "merge already brought master in" assumption — gitlink divergence can SURVIVE every merge because the 3-way base (on master's line) already carries the new pointer, so ours-changed looks intentional and silently wins; verify with `git diff origin/master HEAD -- external/` (must be EMPTY) after any merge that could touch submodules. (2) `git restore --source=origin/master -- external/` does NOT fix gitlinks; use `git checkout origin/master -- external/` (updates the index) and then `git submodule update --init <paths>`. Verify by grepping the checked-out submodule header for the expected symbol before rebuilding.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794960851167-submodule-gitlinks-silently-survive-merges-diff-ex.md`_
