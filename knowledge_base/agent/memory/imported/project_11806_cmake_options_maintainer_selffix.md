---
name: "#11806 CMake Options workflow — maintainer self-fix, PARKED"
description: shader-slang/slang#11806 CI/CMake-Options-workflow bug; maintainer jkwak self-filed AND self-fixed via draft PR #11807; chain parked, no bot action
type: project
originSessionId: e1ea1e53-c807-41c8-98e9-b3fc03315ac5
---
shader-slang/slang#11806 ("CMake Options workflow fails across VS2022, aarch64, and ASAN sweeps") — maintainer jkwak-work self-filed the issue (full diagnosis, 5 failure classes) AND opened draft PR #11807 ("Fix CMake options workflow failures", branch `fix-cmake-options-failed-tests`, `Fixes #11806`) ~1 min before filing. PR's 7 files map exactly onto all 5 classes; triage HEAD-verified (777a78adb, 3 parallel subagents) the approaches are principled. Triager set Issue Type=Bug and posted the verified 5-bullet verdict (issuecomment-4828436833).

The one genuine C++ item is #2: `GenericArgumentInferenceFailure::Kind::None` has no live union member, so copying a None-state `OverloadCandidate` during sort copies an uninitialized union → gcc aarch64 `-Werror=maybe-uninitialized`. Items 1/3/4 touch `.github/workflows/*.yml` (bot can't push), but moot since jkwak authors them.

**Why:** maintainer owns both ends — issue ↔ PR #11807 already linked, full observability exists. A competing bot fix would duplicate his work. Verdict posted per operator "post verified verdicts proactively" policy; fixer-forward PARKED.

**How to apply:** chain PARKED at triage, no fixer dispatch. If a substantive comment lands on #11806 (re-opens per chain rules), or a webhook lands on PR #11807 / it stalls / jkwak asks for help, re-engage — but default is hands-off while the maintainer drives. Don't re-trigger a fresh triage on a routine comment-webhook.
