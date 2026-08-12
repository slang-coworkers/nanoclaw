---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-11T05:14:28.271Z
---

# Draft status does not suppress a closing keyword — only closingIssuesReferences answers "is this linked"

## A draft PR's `Fixes #N` is armed, not dormant

Measured 2026-08-11 on shader-slang/slang#12454. A coworker closed out a chain stating *"the PR is held as a draft, so it won't auto-close #9999."*

```
gh api graphql  closingIssuesReferences on PR #12454
  -> nodes: [ {number: 9999}, {number: 12236} ]

#12454  state=open  draft=true
#12236  state=CLOSED since 2026-07-31, closed by a different PR
```

**Draft status suppresses nothing.** The link is populated while the PR is still a draft, and the keyword fires when the PR **merges** — whether or not it was ever a draft. So the issue would have auto-closed on merge, while the same report stated that every passing number was Linux-debug-only with all 37 build/test jobs skipped on both CI dispatches. **An issue closing on evidence that never compiled on two of three platforms.**

It also linked a **second, already-closed** issue — which merging would have re-closed, implying it fixed something a different PR had fixed two weeks earlier.

### The rule

**Only `closingIssuesReferences` answers "is this linked."** Neither the body text nor the draft flag is readable by eye, and both mislead — in *opposite* directions:

- `Fixes half of #N` **looks** linked and is not (GitHub parses the keyword only when the reference immediately follows it).
- A sentence like *"neither PR resolves #N"* **is** a live closing sequence — prose explaining that linkage is absent can create the very link it denies.

One GraphQL query settles it. Inferring linkage from your own intent is the failure mode, and it is invisible until merge.

### When to demote rather than keep the keyword

If the fix's verification is incomplete — platforms not compiled, CI yielded, a stacked PR fixing only half the issue — **demote to a non-keyword reference (`Refs #N`) and let a human close it.** A sibling chain did this deliberately across two PRs so that the first merge couldn't close a still-live half, and documented the absence as a decision rather than leaving it looking like a typo.

### Two adjacent findings from the same report, both worth copying

**A surviving mutant proves a test suite is decorative.** Reducing a `SeqStmt` walk to `stmts[0]` passed every original test case. Reproducing that (apply → observe FAIL → restore byte-identically) is what showed the new case was load-bearing rather than redundant.

**Count reviewer *independence*, not reviewers.** Of three reviewers on that PR: one died on an API 400 while its wrapper reported `success` with a 96-byte output artifact, and another's "no findings" analysis section was the PR body reflected back verbatim. **A clean-looking 3-of-3 was really 1-of-3.** Before quoting review coverage, check that each reviewer ran and that each read something other than the author's own text.
