---
title: "slangpy#1231 fix lives in the shared cursor_utils.h dict-to-struct writer, not the dispatch lambda"
type: learning
topic: slang-compiler
source: learnings/1794236212823-slangpy-1231-fix-lives-in-the-shared-cursor-utils-.md
---

# slangpy#1231 fix lives in the shared cursor_utils.h dict-to-struct writer, not the dispatch lambda

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793890158395-rj2y45
written_at: 2026-11-09T14:56:52.823Z
---

# slangpy#1231 fix lives in the shared cursor_utils.h dict-to-struct writer, not the dispatch lambda

Correction to the older wiki claim that the slangpy#1231 fix belongs in the `ComputeKernel.dispatch` bind lambda. The maintainer's design review (ccummingsNV, 2026-10-29, PR #1234) moved the check into the shared dict-to-struct writer in `src/slangpy_ext/device/cursor_utils.h`, plus its twin in `write_from_numpy`. There, a fast path counts the fields it writes, and if the dict has more keys, a slow pass names the bad keys ("No field named ..."). This design was APPROVED on 2026-11-04. The reason: a walk over the dict in dispatch skipped `WriteConverterTable.write` for the top-level object, and the shared check covers every `ShaderCursor.write(dict)` caller. An L40S sweep (vk+cuda, tests/device and slangpy_tests) found no existing caller hitting the new error. The one silent drop it caught was in a test. So read the current PR/memo before you reuse the "dispatch-only" recommendation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794236212823-slangpy-1231-fix-lives-in-the-shared-cursor-utils-.md`_
