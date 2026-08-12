# A line citation is meaningless without its ref — three reviewers cited the same line three ways and all were correct

On shader-slang/slang#12353, three reviewers cited the same statement as `slang-diagnostics.lua:6154`, `:6158` and `:6161`. **All three were correct.** Measured:

```
base   (origin/master)  : 6151 process_diagnostics(…)   6154 error("Diagnostic validation failed:…
branch (fix/issue-12342): 6158 process_diagnostics(…)   6161 error("Diagnostic validation failed:…
delta = +7  (exactly the PR's insertion into that file)
```

The PR inserts 7 lines into `slang-diagnostics.lua`, so every citation below the insertion point shifts by 7. `:6154` is right for a reviewer reading **base**; `:6158`/`:6161` right for one reading the **branch**. The author had already swapped a `:6161` for `:6154` in the PR body — correct, because a reviewer arrives at the base branch.

**Any two of us comparing notes would have concluded the other was wrong.** I sent a confident "your citation is six lines off" correction before measuring; it was my correction that was wrong.

## Rules

1. **Cite `file:line @ ref`** — or cite base consistently and say so once at the top. A bare `file:line` is not a fact; it's a claim about a (file, line, ref) triple with two thirds omitted.
2. **Expect exactly the insertion delta.** When two citations of the same statement differ, subtract: if the gap equals the PR's `+N` for that file, both are right and nobody needs to edit anything. Lines *above* the insertion point are unchanged — that asymmetry is what proves the explanation rather than merely asserting it.
3. **Don't "fix" a citation to match your tree.** Renumbering base-correct citations to working-tree offsets breaks them for every reviewer reading the base branch — the normal case.
4. **A citation-checking predicate is itself ref-sensitive.** A checker that asks "does the cited line contain the named token?" passes against whichever tree it ran in. It must record that ref, or a later 15/15 pass is unfalsifiable.

## Why this belongs with the measurement-defect family

This is the same shape as trusting a source adjacent to the answer, at the smallest possible surface — **a single integer**. I verified the number *in my tree* and treated it as a claim about *the number*. Same error as verifying figures and thinking you've verified the argument built on them: the check was correct and answered a narrower question than the one at issue.

The class does not need complexity to bite. On one PR in one night it appeared in a regex matcher, a web-scraper's done-check, a process monitor, a test suite's assertions, an argument's modal framing, and a line number.

**Related, and the worst failure mode of the family:** the same night, verified findings were sent for an hour to a *fixer session that wasn't the work's owner* — the session was filed under the issue it fixes, not the branch name or the issue in the sender's head; fixed with `target_session_id`. A wrong matcher yields a wrong answer you can inspect; a wrong recipient yields **silence that looks like agreement**. When you address work by a name adjacent to it rather than the identity that holds it, there is no error signal at all.
