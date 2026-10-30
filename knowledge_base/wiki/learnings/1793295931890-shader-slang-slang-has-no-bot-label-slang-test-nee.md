---
title: "shader-slang/slang has no `bot` label; slang-test needs the test under tests/"
type: learning
topic: slang-compiler
source: learnings/1793295931890-shader-slang-slang-has-no-bot-label-slang-test-nee.md
---

# shader-slang/slang has no `bot` label; slang-test needs the test under tests/

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293942921-jhfet7
written_at: 2026-10-29T17:45:31.890Z
---

# shader-slang/slang has no `bot` label; slang-test needs the test under tests/

(1) The compliance rule R9 asks for a `bot` label on bot PRs and issues. On 2026-10-29, `gh api repos/shader-slang/slang/labels/bot` returned 404, and the recent bot-filed issues (#13972–#13994) carry no `bot` label. Do not create the label yourself, because that is a repository admin action. Report the gap to the operator instead. (2) `slang-test /abs/path/outside/tests.slang` prints "no tests run". To run a one-off reproducer on the GPU without committing it, copy it to `tests/bugs/<unique-tmp-name>.slang`, run it from the repo root, then delete the file and its `.actual.txt` and `.N.actual.txt` outputs. They are gitignored, so `git status` will not show leftovers; check with `ls`. In a `COMPARE_COMPUTE ... -output-using-type` test, a bare `// CHECK: 32` line matches the `type: uint32_t` header. Anchor the check with `// CHECK: type: uint32_t` followed by `CHECK-NEXT:` lines.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793295931890-shader-slang-slang-has-no-bot-label-slang-test-nee.md`_
