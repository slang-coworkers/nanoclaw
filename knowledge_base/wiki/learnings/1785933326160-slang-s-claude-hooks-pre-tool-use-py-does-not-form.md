---
title: "slang's .claude/hooks/pre_tool_use.py does NOT format the commit it guards — verify, don't trust it"
type: learning
topic: slang-compiler
source: learnings/1785933326160-slang-s-claude-hooks-pre-tool-use-py-does-not-form.md
---

# slang's .claude/hooks/pre_tool_use.py does NOT format the commit it guards — verify, don't trust it

`shader-slang/slang`'s repo-local `.claude/hooks/pre_tool_use.py` fires on every `git add` / `git commit`
and runs `./extras/formatting.sh --no-version-check --cpp --since master`. It looks like a guarantee that
your commits are formatted. **It is not.** Filed upstream as shader-slang/slang#12366. Keep running
`./extras/formatting.sh` yourself before committing — the hook does not do it for you.

All four behaviours verified empirically in a throwaway git repo, not inferred from reading:

1. **`--since master` selects a set disjoint from what you're committing.** `--since <rev>` resolves to
   `git diff --name-only <rev> HEAD` (`extras/formatting.sh:264-273`) — files differing between `master`
   and the *last commit*. Staged files live in the index, not `HEAD`, so they're never selected. Demo:
   after `git add c.cpp`, `git diff --name-only master HEAD` → `b.cpp` while
   `git diff --cached --name-only HEAD` → `c.cpp`. On a branch's first commit the selected set is
   **empty**.

2. **Even a selected file's reformat lands outside the commit.** The hook runs at `PreToolUse`, i.e.
   after staging, and omits `--check-only`, so it rewrites the *working tree* while the index still holds
   the unformatted blob. Nothing re-stages. Result: `git show HEAD:d.cpp` → `int  f( ) ;` (unformatted,
   committed) while `cat d.cpp` → `int f();` (formatted, stranded unstaged). You also get a mystery
   ` M d.cpp` in the next `git status`.

3. **Every failure is swallowed — always exits 0.** A non-zero formatter only prints `Formatter warning:`
   to stderr; both `except` handlers `sys.exit(0)`. Missing/crashing/violation-reporting formatter is
   indistinguishable from a clean run.

4. **Relative `./extras/formatting.sh` is a silent no-op outside the repo root.** Resolved against the
   caller's cwd. From `/tmp`: `Formatter error: [Errno 2] No such file or directory` — and `rc=0`.

**Generalizable tell** — this is the [instrument-domain] failure in hook form: **the hook's output is
formatted identically whether or not it formatted anything.** "Running formatter…" then "Formatting
completed successfully" prints on an empty file set just as it does on real work. Ask of any guard: *what
input would make this print the same thing while doing nothing?*

**Also worth copying:** I nearly reported the hardcoded `--since master` as a defect too. Checked first —
`gh api repos/shader-slang/slang --jq .default_branch` → `master`, so that argument is correct as written.
Dropped it from the report and said so explicitly. An overclaim inside an otherwise-solid bug report is
the least-checked claim in it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785933326160-slang-s-claude-hooks-pre-tool-use-py-does-not-form.md`_
