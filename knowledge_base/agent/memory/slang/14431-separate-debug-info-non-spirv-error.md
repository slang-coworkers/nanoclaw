---
type: chain
title: slang#14431 — `-separate-debug-info` on a non-SPIR-V target should be an error
description: Maintainer (jkwak-work) self-filed + self-assigned 11-10 02:04Z, then CLOSED not_planned 02:08:46Z ("the warning is intended", per #7777 review). TERMINAL. Bot never dispatched or posted.
tags: [slangc, command-line, diagnostics, separate-debug-info, maintainer-owned, closed-not-planned]
---

# slang#14431 — `-separate-debug-info` non-SPIR-V: warning → error

**11-10 02:04Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work** (MEMBER), assigned to
jkwak-work by jkwak-work at 02:04:22Z (same second as filing), 0 labels, 0 comments. Timeline `referenced`
at 02:04:40Z from commit `91aef2476b` in the **jkwak-work/slang** fork (commit body unreadable: 401 on the
fork commit API). No open PR names it yet; jkwak-work's open #14422 is the [#14266](14266-diag-tests-exit-code.md)
`diag=` exit-code work, which this issue says must update the two tests' `exit-code=0`.

**Ask.** E00018 `separate-debug-info-unsupported-for-target` is `warning(...)` in
`source/slang/slang-diagnostics.lua`; emitted twice in `source/slang/slang-options.cpp` (per `m_rawTargets`
entry, and default target). Make it an error. Tests:
`tests/diagnostics/command-line/separate-debug-info-unsupported-{glsl,target}.slang`. Open question in the
issue: compatibility (build systems passing the flag for all targets) — maintainer decision.

**Disposition: held, nothing dispatched or posted.** Same class as #14266 / [#14292](14292-slang-test-exit-code-all-test-types.md) /
[#14430](14430-capability-check-static-member-generic.md): maintainer filed and self-assigned, asked the bot for
nothing (rung 4). **Resume** only on an @nv-slang-bot mention or an operator ask; mentions arrive as webhooks, so no timer.

**11-10 02:08Z — CLOSED `not_planned` by jkwak-work (TERMINAL).** Comment
[6756948446](https://github.com/shader-slang/slang/issues/14431#issuecomment-6756948446): the warning is
intended. E00018 was an error in the first version of #7777, and a reviewer asked for a warning so the
compile still succeeds: separate debug info is a side output, so a target that cannot produce it does not
break the build. `-debug-info-include-source` follows the same rule. The two tests keep `exit-code=0`.
Arrived as `github.pr_mention`, but the GitHub comment body has no @nv-slang-bot mention, so there is
nothing to authorize or relay. Nothing dispatched or posted. Durable fact: E00018 is a warning **by design**,
so don't file or fix it as a bug.
