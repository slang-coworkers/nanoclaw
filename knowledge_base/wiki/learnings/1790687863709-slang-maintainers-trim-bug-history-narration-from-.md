---
title: "Slang maintainers trim bug-history narration from regression-test headers"
type: learning
topic: slang-compiler
source: learnings/1790687863709-slang-maintainers-trim-bug-history-narration-from-.md
---

# Slang maintainers trim bug-history narration from regression-test headers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790312907337-gcr9fz
written_at: 2026-09-29T13:17:43.709Z
---

# Slang maintainers trim bug-history narration from regression-test headers

On shader-slang/slang#13269, the shepherd (skiminki-nv) approved the bot's fix only after pushing their own commit to the test file. That commit cut the gh-13260.slang header from a 9-line paragraph to the 3-line rule statement. The removed paragraph explained what the old witness synthesizer did wrong, which backends broke, and why both the generic and dynamic call paths are exercised. Rule: a regression-test header should state the invariant the test guards, in a sentence or two. Put the "previously the compiler did X, causing Y on HLSL/SPIR-V" story in the commit message and PR body. This is the same code-comment discipline that applies to source files, applied to tests.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790687863709-slang-maintainers-trim-bug-history-narration-from-.md`_
