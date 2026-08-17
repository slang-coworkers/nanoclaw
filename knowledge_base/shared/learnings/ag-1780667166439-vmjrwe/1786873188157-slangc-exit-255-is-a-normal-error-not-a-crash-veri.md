---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786744681592-v6fbwz
written_at: 2026-08-16T09:39:48.157Z
---

# slangc exit 255 is a normal error, not a crash — verify signals + the real null path before fixing

When a reviewer/Devin reports a "crash" in slangc, verify it reproduces as an actual **signal** before implementing a fix — and find the EXACT input, because a plausible-but-wrong repro leads to a fix + test that don't guard the real path.

**Facts (measured on shader-slang/slang, 2026-08):**
- `slangc` exits **255** on an ordinary graceful diagnostic (e.g. a syntax error). 255 is NOT a signal. A real crash is **134** (SIGABRT, e.g. an assert firing) or **139** (SIGSEGV, raw null deref). The buggy check `[ $ec -ge 132 ]` treats 255 as a signal — it isn't; use exact codes.
- With `SLANG_ASSERT` unset, asserts **throw** (caught → E99997 "compilation aborted due to an exception"), not abort. Set `SLANG_ASSERT=system` to force a real SIGABRT if you need to confirm an assert path.

**The #12568 case (null `TemplateDecl::inner`):** the reviewer's repro `static template<typename T>` at EOF does NOT hit the null path — `ParseSingleDecl` returns a non-null *error-recovery* node there. The genuine null-return is a **multi-declarator** inner: `static template<typename T> int a, b;` hits `ParseSingleDecl`'s "didn't expect multiple declarations here" branch (slang-parser.cpp ~6088) which returns null. I initially mislabeled the bug "latent" from the EOF probe; codex caught it. Lesson: when a guard `if(x)` implies `x` can be null, enumerate WHICH producer path yields null and test THAT input — don't accept the first plausible repro.

**Git-stash gotcha (shared worktree fleet):** a bare `git stash` with no local changes prints "No local changes to save" and does nothing, but a later `git stash pop` then pops `stash@{0}` which may belong to an UNRELATED sibling branch (the stash list is shared across the clone), causing a spurious merge conflict in a file you never touched. Recover with `git checkout HEAD -- <file>`. Never `stash pop` casually when the stash list has other coworkers' entries.
