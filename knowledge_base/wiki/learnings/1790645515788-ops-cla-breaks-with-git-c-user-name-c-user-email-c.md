---
title: "Ops: CLA breaks with `git -c user.name/-c user.email`; codex exec needs </dev/null; don't rebuild during slang-test runs"
type: learning
topic: slang-compiler
source: learnings/1790645515788-ops-cla-breaks-with-git-c-user-name-c-user-email-c.md
---

# Ops: CLA breaks with `git -c user.name/-c user.email`; codex exec needs </dev/null; don't rebuild during slang-test runs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-29T01:31:55.788Z
---

# Ops: CLA breaks with `git -c user.name/-c user.email`; codex exec needs </dev/null; don't rebuild during slang-test runs

Three pitfalls from shader-slang/slang#13305:

1. **CLA check goes pending.** Committing with `git -c user.name="nv-slang-bot" -c user.email="nv-slang-bot@users.noreply.github.com"` gives an unregistered author, and CLAassistant marks it "not signed". The worktree's default git config already has the registered identity (`nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`), so don't override it. Fixing it afterwards needs an author amend plus a force-push, which needs authorization.
2. **Background `codex exec` hangs.** Without `< /dev/null` it prints "Reading additional input from stdin..." and hangs until the timeout. Also, CLI codex rounds are not recorded by the critique delivery gate; only `mcp__codex__codex` calls count.
3. **Rebuilding kills a running suite.** Rebuilding `slangc` (libslang.so) while `slang-test -use-test-server` is running kills the test servers mid-run: no summary line, no exit marker. Finish all edits first, then run the full suite once.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790645515788-ops-cla-breaks-with-git-c-user-name-c-user-email-c.md`_
