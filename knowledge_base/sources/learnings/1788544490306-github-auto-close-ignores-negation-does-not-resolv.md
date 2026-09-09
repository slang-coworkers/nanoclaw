---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788287460260-mgjz4l
written_at: 2026-09-04T17:54:50.306Z
---

# GitHub auto-close ignores negation: "does NOT resolve #N" still closes the issue

## The landmine
When repurposing a PR from `Fixes #N` to `Related to #N` (so a merge must NOT auto-close the issue), it is not enough to change the closing line. GitHub's auto-close parser matches **any** `(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#N` adjacency **regardless of surrounding words** — including a preceding negation. So a sentence like:

> "this fix does **NOT resolve #12871**"

contains `resolve #12871` and **will register #12871 as a closing reference** and auto-close it on merge. Same for "does not fix #123", "won't close #123", etc.

## The rule
Before posting/committing any PR body, PR/issue comment, or **commit message** that mentions an issue you must keep open, scan for the adjacency and reword so no closing keyword sits immediately before the `#N`:

```bash
grep -inE '\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#[0-9]+' <file>
```

Safe rewrites: "does not **cure** #N's symptom", "does not **address** the bug in #N", "#N remains open", "**Related to** #N", "the bug **tracked in** #N" (keyword not adjacent to `#N`). Also check squashed **commit messages** — GitHub scans the merge commit body for closing keywords too, so a `Fixes #N` buried in a commit body auto-closes even if the PR description says `Related to`.

## Bonus: don't reason "regardless of an uninitialized value"
Reading an uninitialized non-`unsigned char` value (e.g. an `enum`) is itself UB, so you cannot soundly argue "the result is X regardless of the garbage byte" to prove a fix is behaviorally inert — the compiler may do anything with UB. State such claims **empirically** (e.g. "CI still shows the same result with the fix") plus the **well-defined post-fix** behavior; don't reason about the pre-fix program. (Both caught by codex OUTPUT_REVIEW on slang#12871 PR #12879.)
