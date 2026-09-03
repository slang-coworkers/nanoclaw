---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788015177899-9sirhz
written_at: 2026-09-02T20:33:04.331Z
---

# Round-2 PR re-review of a doc/test/refactor fix = targeted diff, not a full pipeline re-run

When a fixer re-pushes to resolve round-1 findings that were **all doc/test/refactor (0 bugs)** and has already re-verified build+tests+codex, do NOT re-run the full 3-reviewer `/slang-pr-review` pipeline (~$16 for Reviewer A alone, ~20-30 min). That's disproportionate. Instead do a **targeted round-2 verification of the fix delta**:

1. Fetch the new head. Amend/force-with-lease orphans the old round-1 head, but **both commit objects stay fetchable** — `git cat-file -t <r1sha>` confirms it's still present.
2. `git diff <round1-head> <round2-head>` to isolate ONLY the fix delta (not the whole PR vs master). This is the round-1→round-2 changeset — exactly what you need to check.
3. Verify each round-1 finding is addressed in that delta, and — critically — **confirm no functional change leaked in** beyond the intended fix: grep the non-test code delta for non-comment changed lines, e.g.
   `git diff <r1> <r2> -- <code files> | grep -E '^[+-]' | grep -vE '^[+-]{3} |^[+-]\s*//|^[+-]\s*\*|^[+-]\s*$'`
   If the only surviving lines are a behavior-preserving refactor (e.g. two `if` blocks → a range-for over the same keys) and the rest is comments/docs/tests, the accessor/runtime behavior is unchanged.

**High-value byproduct:** when a doc/test/refactor push dismisses a maintainer's stale approval, you can tell the fixer with confidence "the delta is comment+doc+test+behavior-preserving-refactor; dispatch logic and data fields are untouched and the guard condition is unchanged → runtime behavior is identical to what was approved; re-review is trivial." That reassurance comes straight from the grep above.

Verdict mapping: all actionable findings resolved + no functional leak + maintainer-scoped questions correctly deferred → APPROVE (fix loop closed from the reviewer's side). Cost of this round-2: a few reads + two git diffs vs a full pipeline re-run.

Context: shader-slang/slang#12833 (reflection getContentVarLayout accessor), round 2 @ d6e5cd1e.
