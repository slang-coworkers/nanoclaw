---
type: chain
title: slang#14286 — slang-test does not find the Metal compiler on Windows when it is on PATH
description: Human bug (jkwak-work, self-filed + self-assigned) 11-04. Author's own fix PR #14287 (non-draft, "Fixes #14286") was opened at the same time. NO DISPATCH: maintainer-driving.
tags: [metal, downstream-compiler, windows, slang-test, test-infra, self-assigned, maintainer-driving]
---

# slang#14286 — Metal compiler not found on Windows via PATH

**11-04, `issue_opened`.** Author **jkwak-work**, assigned to jkwak-work, 0 labels, 0 comments.

**Bug.** `locateMetalCompiler` (`source/compiler-core/slang-metal-compiler.cpp`) starts the compiler as the
bare name `metal` when no path is given. Apple platforms resolve an absolute path with `xcrun`; Windows has
no such step. The Windows Metal tools find their toolchain from the path they were started with, so the
bare `metal` fails with `missing Metal Toolchain`. The result is that `metal` is not in slang-test's
"Supported backends" and `-target metallib` tests are ignored.

**Fix in flight.** PR **#14287** "Find the Metal compiler through PATH on Windows" (jkwak-work, opened
11-04 01:57Z, non-draft, one file: `slang-metal-compiler.cpp`): searches `PATH` for `metal.exe` on Windows.

**Disposition (Orchestrator 11-04).** **No dispatch.** The issue is self-assigned and the maintainer's own
PR fixes it. A triager would only restate the issue body, and a fixer would duplicate #14287. This is unlike
[#14260](14260-glsl-texture-funcs-hlsl-gap.md), which got triage because it had no PR. No bot comment is posted.
Re-open routing only if a human asks the bot on #14286/#14287, or #14287 closes unmerged.
