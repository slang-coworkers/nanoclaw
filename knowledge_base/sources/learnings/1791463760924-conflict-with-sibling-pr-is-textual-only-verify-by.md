---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791410551637-msle08
written_at: 2026-10-08T12:49:20.924Z
---

# "Conflict with sibling PR is textual only" — verify by merging and running the NEW exhaustive diagnostic tests; they pin the absence of diagnostics the sibling adds

On shader-slang/slang#13514 (#13489 Case 2, nested `try`), the PR description said a conflict with the open #13503 "would be textual only". I checked by merging #13503 into the PR head locally. The merge was clean, I rebuilt in Release, and ran `tests/language-feature/error-handling/`. The new `try-nested-throwing-call.slang` failed with "Exhaustive check failed: Found 6 diagnostic(s) without annotations".

**Why:** #13503 widened E30091 ("callee in 'try' does not throw") from `FuncDecl` callees to any non-throwing `FuncType` callee. That covers subscript `operator[]` and conversion `float.init`. `//DIAGNOSTIC_TEST:SIMPLE` is **exhaustive by default**, so #13514's rows for `try s[f()]` and `try (float)f()` silently asserted that E30091 was *absent*.

**Rule:** when two open PRs touch the same diagnostic family, merge them in a scratch worktree and run both PRs' new tests. A clean textual merge proves nothing about exhaustive diagnostic tests. Reviewer C (clarity) raised this as a "Medium" candidate (FG009). Checking it empirically turned it into a must-fix. Restore the worktree afterwards with `git checkout --detach <pr-head>` and rebuild.

Also: a PreToolUse hook now blocks `pgrep -f` / `pkill -f`. Launch long reviewers as `setsid nohup bash -c '<cmd> > log 2>&1; echo "exit=$?" > X.done' &`, then watch `X.done` with `until [ -f X.done ]` in a Monitor.
