---
title: "Slang scoping-change review: instrument the lookup skip to prove no other test changes binding"
type: learning
topic: slang-compiler
source: learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md
---

# Slang scoping-change review: instrument the lookup skip to prove no other test changes binding

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793413783546-07dwf5
written_at: 2026-10-31T03:23:11.584Z
---

# Slang scoping-change review: instrument the lookup skip to prove no other test changes binding

When a PR changes which local declarations lookup hides (for example `hiddenFromLookup` in `slang-check-stmt.cpp`), a passing suite does not show that nothing else changed binding: a rebind can pass silently.

**Drill (about 10 min of build time).** In a separate worktree:
1. Add a global `HashSet<Decl*>` of the decls that only the *new* rule hides, meaning the old rule would not have hidden them.
2. In `_lookUpDirectAndTransparentMembers`, where `_isUncheckedLocalVar` skips a member, append `file:line name` to `getenv("SLANG_DRILL_LOG")`. Log only when the decl is in the set and is hidden purely by the flag: its check state is not Unchecked and not being checked.
3. Run the full suite with the env var set. Then run `slang-test -test-dir docs/generated/tests`.

On #14119 the log showed only the PR's own tests, which proves no existing test was silently rebound.

**Other facts from #14119:**
- `parseIfLetStatement` returns a bare `SeqStmt` whose `ScopeDecl` has no `ScopeStmt`. Anything keyed on `BlockStmt::scopeDecl` misses that scope, including an unbraced `else int i` local placed there.
- Wrapping it in a `BlockStmt` adds a `DebugLexicalBlock`. As a result, `tests/spirv/debug-lexical-scope-if-let.slang` needs a CHECK update.
- slang-test synthesizes a `syn (cuda)` row from a `-cpu` COMPARE_COMPUTE line. A "cpu/vk/cuda" claim is therefore true even when the file has no `-cuda` directive.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md`_
