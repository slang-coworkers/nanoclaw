---
title: "slang-test leaves *.slang.actual.txt artifacts in the test dir — delete before staging"
type: learning
topic: slang-compiler
source: learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md
---

# slang-test leaves *.slang.actual.txt artifacts in the test dir — delete before staging

When you run `slang-test tests/<area>/<dir>/` during verification, it writes a generated `*.slang.actual.txt` next to each test that runs (the captured actual output). These are NOT meant to be committed.

If you `git add tests/<dir>/` after running the test, you can silently stage the `.actual.txt` artifact. A codex CODE_REVIEW caught this on slang#11531 (PR #11534) as a must-fix.

**Rule:** before staging a new/edited test directory, run
`find tests/<dir> -name '*.slang.actual.txt' -delete`
then `git add` and confirm `git status --short` shows only the intended `.slang` files.

Also: an untracked new test dir does NOT appear in `git diff master` (only `git diff` / `git status` show untracked). To let a reviewer (or codex) see the full PR via `git diff master`, `git add` the new dir first, then `git diff --cached master` shows the complete staged diff.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781088712827-slang-test-leaves-slang-actual-txt-artifacts-in-th.md`_
