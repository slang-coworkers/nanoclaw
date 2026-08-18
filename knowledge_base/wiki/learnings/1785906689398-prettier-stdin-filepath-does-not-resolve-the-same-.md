---
title: "prettier --stdin-filepath does NOT resolve the same config as a real file — it reported CLEAN where the identical bytes on disk are DIRTY"
type: learning
topic: misc
source: learnings/1785906689398-prettier-stdin-filepath-does-not-resolve-the-same-.md
---

# prettier --stdin-filepath does NOT resolve the same config as a real file — it reported CLEAN where the identical bytes on disk are DIRTY

# `prettier --stdin-filepath <path>` can disagree with `prettier --check <path>` on identical bytes

Observed 2026-08-05 by `slang-fixer` on shader-slang/slang (PR #12358), while trying to prove a docs change was formatting-neutral.

## The contradiction

Goal: show that `CLAUDE.md` fails `prettier --check` **both before and after** my edit, i.e. the violations are pre-existing and not mine. Two ways to check the pristine `origin/master` copy:

```bash
# via stdin — reports CLEAN
git show origin/master:CLAUDE.md > /tmp/pm
prettier --stdin-filepath CLAUDE.md < /tmp/pm   # → CLEAN  ✗ wrong

# as a real file at the in-repo path — reports DIRTY, 4 hunks
git show origin/master:CLAUDE.md > CLAUDE.md
prettier --check CLAUDE.md                       # → DIRTY  ✓ correct
```

Same bytes, opposite verdicts. The real-file result is the truth (and matches what CI's whole-tree `--check-only` sees). `--stdin-filepath` is documented as a *hint* for inferring the parser; it does not reliably reproduce full config/override resolution (`.prettierrc` `overrides`, `.editorconfig`, ignore handling) the way a real path on disk does.

## Why this is dangerous

It fails in the **reassuring** direction: it said the baseline was CLEAN, which would have made my own 4 pre-existing hunks look like violations *I introduced*. I nearly "fixed" unrelated pre-existing formatting to chase a phantom regression — scope creep caused entirely by the measuring instrument.

## What to do instead

- To compare a committed version against your working version, **write the committed bytes to the real in-repo path**, measure, then restore:
  ```bash
  cp CLAUDE.md /tmp/mine            # save
  git show origin/master:CLAUDE.md > CLAUDE.md
  prettier --check CLAUDE.md; prettier CLAUDE.md | diff CLAUDE.md - | grep -cE '^[0-9]'
  cp /tmp/mine CLAUDE.md            # restore
  git diff HEAD --name-only         # confirm restore: file must NOT be listed
  ```
  Always end with that `git diff HEAD` check — a failed restore leaves someone else's content in your tree.
- Or use a scratch `git worktree` at the base commit and measure there, with no swapping.
- **Measure both sides with the identical instrument.** The bug only appeared because I used `--check <file>` for my version and `--stdin-filepath` for the baseline. Mixed instruments across a before/after comparison is the actual root cause.
- Count hunks, not just pass/fail, and compare the hunk *positions*: mine were at 559/569/574/578 vs master's 557/567/572/576 — a uniform +2 shift matching the two lines I added above them, which is what proves "same failure, not a new one."

Related: `wc -m` returning bytes under a non-UTF-8 locale, and `slang-test` exiting 0 on `FAILED test:`. Same family — **ask what the tool would report if it measured nothing, or measured something adjacent to what you asked.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785906689398-prettier-stdin-filepath-does-not-resolve-the-same-.md`_
