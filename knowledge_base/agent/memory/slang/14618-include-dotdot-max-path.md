---
type: project
title: "slang#14618 — `#include` with `..` segments fails once the joined path reaches 260 chars (Windows MAX_PATH)"
description: Chain record for issue 14618; fixed via draft PR #14625 (simplify include path before OS check)
---

# slang#14618 — include `..` segments fail at joined-path 260 chars

HUMAN-filed 11-18 23:10Z by pdeayton-nv (no labels/assignees at filing). R6 dispatch at
once: 👀 posted, slang-triager sent on canonical thread `gh-issue-shader-slang/slang-14618`.

**TRIAGED 23:19Z** (triager sess m685z1, memo in /workspace/inbox/…/triage-14618.md):
bug / medium / P2 / frontend (include system + core FS). NOT a dup. Root cause:
`IncludeSystem::findFile` hands the unsimplified joined include path (redundant `..`
intact) to the OS existence check; `..`-collapsing happens only later in the preprocessor.
Windows stat/open reject strings > MAX_PATH(260). Reproduced on top-of-tree 4a1d62c5b on
Linux via the PATH_MAX analogue (830-hop include, joined 4204 > 4096 → E15300; ≤700 hops
compile). Labels `reproduced` + Issue Type `Bug` applied; triage cmt 6994533447.
Related: **#14612** (same surface — this fix also serves its simplified-path diagnostics ask).
Rec approach A1: simplify inside `IncludeSystem::findFile` before the getPathType check.

**Fixer chain** (sess ntam6a, pr-mapping wired): first session errored 23:59Z (infra
"something went wrong"); triager re-dispatched in full 00:00Z on the same thread — resumed
clean, no operator intervention needed. **TERMINAL our side 02:38Z: draft PR #14625**,
final head `7dcd9fe65` (nits applied without another round; first head 74839bbe).
Fix = one-line `combinedPath = simplifyPath(combinedPath);` at
source/compiler-core/slang-include-system.cpp:63 (one simplified spelling for
check/identity/foundPath) + preprocessor's now-idempotent downstream simplify deleted
(was slang-preprocessor.cpp:3680) + regression test
tests/preprocessor/include-long-dotdot-chain.slang. +38/−3, `pr: non-breaking`.
Revert drill: test fails E15300 pre-fix, passes post-fix; tests/preprocessor 85/85;
full suite 12364/12367 (3 known pre-existing fp8-cuda flakes). Review APPROVE_WITH_NITS
(0 bugs; Devin's symlink-semantics flag disputed, left for the maintainer); codex gates
approve. Explanation comment 6996671893 (updated for final head).

**Maintainer round 3 (11-19 11:00Z, Main-verified report):** maintainer asked for rebase +
backslash-path test fix; done at **head `4faa7d5ef`** (rebase onto master a4d69f877 clean,
preprocessor deletion re-applied at #14514's relocated source/slang/preprocessor/slang-preprocessor.cpp).
Side fix: multiFileModuleCache was broken on Windows (split on OS `\` vs `/`-separated
MemoryFileSystem paths) — portable `Path::kPathDelimiter` (commit 981385685), sweep found no
other offenders. multiFileModuleCache 1/1, unit 687/687, preprocessor 85/85, codex gates
approve. TODO comment patched (7006028275); explanation comment 6996671893 re-updated.

**MAINTAINER APPROVED 11-19 17:03Z:** pdeayton-nv approved PR #14625 (review 5979618832,
no findings, no open threads) at head `4faa7d5ef`; PR flipped ready by a human. NOTE: the
round-3 force-push AUTO-DISMISSED this approval (reviewDecision empty, mergeState BLOCKED);
completion cmt 7018370274 (18:35Z) tells pdeayton-nv re-approval/merge sits with him, discloses
the falcor rerun. PR's own pull_request_target CI green (run 44579088724, 17:36Z).

**TERMINAL — MERGED 11-19 18:53Z:** PR #14625 merged by pdeayton-nv (merge commit `bb2b7e33d`);
issue #14618 auto-closed. Final: 5 files, +42/−5, 4 commits — include-path `..`-collapse at
`IncludeSystem::findFile` before the OS check, preprocessor dup-simplify deleted,
multiFileModuleCache portable-delimiter fix. Total chain time: filed 23:10Z 11-18 → merged
18:53Z 11-19 (~20 h, including one fixer infra error + maintainer rebase round).

**One loose end (fixer watching by webhook):** the bot-dispatched Falcor rerun on head
`4faa7d5ef` (run 44506722744) was still queued at merge time. If it fails again → possible
REAL Falcor regression now on master (candidate mechanism: lexical `..` resolution now
governs the existence check — the review's documented gap). Fixer investigates from a fresh
worktree then; do not open a new chain for that webhook unless the rerun actually fails.
