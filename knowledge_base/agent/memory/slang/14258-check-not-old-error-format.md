---
type: chain
title: slang#14258 — tests: CHECK-NOT lines in the old `error NNNNN` format never match
description: Maintainer (jkwak-work) self-filed and self-assigned test-hygiene issue, 2026-11-03 21:34Z. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [test-infra, filecheck, diagnostics-format, maintainer-owned, held]
---

# slang#14258 — stale `CHECK-NOT: error NNNNN` lines

**11-03 21:34Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work at filing (timeline `assigned`, 21:34:13Z), 0 labels, 0 comments, no linked PR.

**Ask.** 7 test files have `CHECK-NOT: error <digits>` lines; the compiler prints `error[E<digits>]`, so the
negative check can never fire. Fix is to rewrite them to `E<digits>` / `error[E…]: …`; the author reports all
7 pass after the rewrite. Files: `diagnostics/glsl-global-const-with-init.slang`,
`diagnostics/sv-semantic-type-validation.slang` (8 prefixes), `hlsl-intrinsic/matrix-int-mul.slang`,
`language-feature/capability/var-capability-wgsl-2.slang`,
`language-feature/dynamic-dispatch/diagnose-ref-com-interface.slang`,
`language-feature/dynamic-dispatch/diagnose-ref-interface-return.slang`,
`language-feature/generics/specialize-with-existential-1.slang`. Also suggests other old forms
(`error: <text>`) and a `slang-test` warning for unmatchable `-NOT:` patterns.

**Disposition: held, nothing dispatched or posted.** Same class as
[#14215](14215-validate-with-downstream-compiler.md) (same author, same day, cross-referenced in this
issue): a maintainer filed and self-assigned the work and asked the bot for nothing. The stand-down comes
from the self-assignment, not from an R6 hold.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.
