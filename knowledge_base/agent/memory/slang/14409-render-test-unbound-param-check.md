---
type: chain
title: slang#14409 — render-test runs with unbound resource parameters; -cpu/-cuda then crash slang-test in-process
description: Bot-filed 11-08 10:14:52Z by the #14407 slang-triager as the split-out general check. Owned by the #14407 chain; FILED-ONLY, no dispatch. A fixer chain for it was offered to the operator 11-08 (by the #14407 Main session); one-shot recheck-14409-operator-chain 11-11 10:20Z.
tags: [render-test, test-tooling, test-input, cpu, cuda, bot-filed, follow-up, filed-only]
---

# slang#14409

**Filed** 11-08 10:14:52Z by slang-triager (`sess-1794132550422-zvt5p6`) during [#14407](14407-render-test-indented-test-input.md)
triage; labels `reproduced`, Type Bug; unassigned, 0 comments at 10:20Z. The #14407 triage comment (10:15:39Z) scopes it out:
"a parameter with no binding crashes `-cpu`/`-cuda` instead of producing a diagnostic … tracked in #14409".

**Bug.** `_assignVarsFromLayout` (`tools/render-test/render-test-main.cpp:947-960`) flags a TEST_INPUT with no parameter but
never a parameter with no TEST_INPUT. `-vk` reads 0; `-cpu` SIGSEGV (CPU prelude `operator[]` on `{nullptr,0}`); `-cuda`
ILLEGAL_ADDRESS + assert. Default spawn is `UseSharedLibrary`, so the crash kills slang-test itself. Sources of an unbound
param: indented TEST_INPUT (#14407), missing TEST_INPUT (#12499 — that chain is archived/closed 09-11), TEST_INPUT in an `#include`.

**Disposition (Orchestrator, 11-08): filed-only, no triager or fixer.** Reasons: (1) already reproduced by the triager — a
second triage adds nothing; (2) same render-test files as the #14407 fix in flight (slang-fixer `sess-1794132916394-9erno5`,
worktree `wt-slang-14407`) — a parallel chain would collide; (3) the issue itself warns existing vk/D3D tests may rely on
reading 0 and need a full-suite run plus maybe an opt-out — sequence it after #14407 lands, same fixer. Precedent:
[#14264](14264-cuda-half-match-all-sync.md). Sibling Main sessions on this `issue_opened` must NOT dispatch.

**Operator ask (11-08, #14407 Main session `sess-1794132461734-jvc0pn`).** Fixer chain for #14409 offered to the operator,
not opened; one-shot task `recheck-14409-operator-chain` at 11-11 10:20Z. The `issue_opened` webhook (Main session
`sess-1794132894148-pzcpfq`) held per this disposition — no dispatch, no second operator ask.

**Resume on:** the operator's ruling (→ slang-fixer, thread `gh-issue-shader-slang/slang-14409`; prefer the #14407 fixer
`sess-1794132916394-9erno5` after its PR lands); a human comment on #14409; the 11-11 recheck.
