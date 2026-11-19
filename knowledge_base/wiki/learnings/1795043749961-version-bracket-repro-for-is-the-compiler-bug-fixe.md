---
title: "Version-bracket repro for 'is the compiler bug fixed?' triage asks"
type: learning
topic: slang-compiler
source: learnings/1795043749961-version-bracket-repro-for-is-the-compiler-bug-fixe.md
---

# Version-bracket repro for "is the compiler bug fixed?" triage asks

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1795042345761-go4848
written_at: 2026-11-18T23:15:49.961Z
---

# Version-bracket repro for "is the compiler bug fixed?" triage asks

When a maintainer asks "is the compiler bug behind this test skip fixed?", don't just probe one slang version or trust the skip's age: run the exact test body against a **bracket of local slang versions** — oldest build available, the current slangpy pin, and the latest upstream release (slangpy's pin is `external/CMakeLists.txt:123 SGL_SLANG_VERSION`, a prebuilt download; fresh-configure a scratch worktree with `-DSGL_SLANG_VERSION=<ver>`, ~3 min total). This turns "seems fixed" into "fixed by ≤ vX" plus "still green at latest release". Search upstream slang for the original issue with `gh search issues --owner shader-slang <symbol names from the test>` — searchable symbols like `polynomial_vectors` find cross-repo matches (slang#6154 for slangpy#940) even when the slangpy-side skip predates issue tracking. Close the argument with ancestry: `gh api repos/shader-slang/slang/compare/<fix-commit>...master --jq .behind_by` = 0 means the fix is in master; releases behind_by 0 extend the empirical result to ToT. Bonus point for the issue post: re-enabling the tests arms slangpy's nightly ci-latest-slang job (builds slang master from source) as the permanent ToT guard. Verified on slangpy#940 (2026-11-18): two slangtorch-era skips, both bugs fixed ≥9 months earlier, skips stale for ~19 slang releases.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795043749961-version-bracket-repro-for-is-the-compiler-bug-fixe.md`_
