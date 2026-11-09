---
type: chain
title: slang#14258 — tests: CHECK-NOT lines in the old `error NNNNN` format never match
description: Maintainer (jkwak-work) self-filed and self-assigned test-hygiene issue, 2026-11-03 21:34Z. Held until 11-08 12:12Z, when the author @-mentioned the bot asking for triage ("I think we can close this now but not sure") -> dispatched to slang-triager.
tags: [test-infra, filecheck, diagnostics-format, maintainer-owned, awaiting-maintainer]
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

**11-05 05:27Z.** A stand-down comment was posted by the bot (it says the issue is assigned to @jkwak-work and offers help on a mention).

**11-08 12:12Z, `pr_mention`** ([comment](https://github.com/shader-slang/slang/issues/14258#issuecomment-6721331977)), jkwak-work:
"@nv-slang-bot can you triage? I think we can close this now but not sure". Live read: still OPEN, assigned
jkwak-work, 0 labels. Referenced by commits of jkwak-work's PR #14269 ("slang-test: fail SIMPLE tests on an
unexpected exit code", MERGED 11-04 21:37Z), which did not auto-close it. **Dispatched to `slang-triager`** on
`gh-issue-shader-slang/slang-14258` with `<github-post-authorized />`. The question for the triager: are all 7 listed
`CHECK-NOT: error NNNNN` lines fixed on master, and are there other old-format `-NOT:` lines left? Then
recommend close or list what remains. The triager posts the answer on the issue; closing it is the maintainer's decision.

**11-08 12:20Z, triaged** ([comment](https://github.com/shader-slang/slang/issues/14258#issuecomment-6721412268); memo
`/workspace/inbox/a2a-1794140473922-t68lw3/triage-14258.md`). Triager on master `ae4e579`: **don't close yet**. #14269
(`d6ad99cb3`) rewrote all 7 listed files, and they pass, but 10 old-form lines in 6 files remain:
`hlsl-intrinsic/matrix-int-mul.slang:3` (`E39999: ambiguous…` still can't match `error[E39999]:`, so #14269's own
rewrite is wrong), `bugs/gh-4414.slang:8` (`CHK-NOT:error 39999`, no space, so the issue's grep missed it), and 4 files
with `warning 410xx` (the real gap, because warnings don't affect the exit code). Labels `reproduced` + Type Bug were applied.
I spot-checked the first two lines and the comment against GitHub, and they match. **Parked on jkwak-work:** fix the 6 files, then close, or close now
and open a follow-up. The triager offered a draft PR on mention, and no fixer chain was opened. Resume on mention (webhook); no timer.
