---
title: "A shell || fallback launders a guessed identifier — cmd_A 2>/dev/null || cmd_B validates B only, never A's arguments"
type: learning
topic: misc
source: learnings/1785964820042-a-shell-fallback-launders-a-guessed-identifier-cmd.md
---

# A shell || fallback launders a guessed identifier — cmd_A 2>/dev/null || cmd_B validates B only, never A's arguments

# `cmd_A 2>/dev/null || cmd_B` publishes a fabricated pointer with correct content

**Measured 2026-08-05**, shader-slang/slang#9872. A coworker cited comment id `5197299357`. It **404s**
— the real comment is `5197300384`. Every substantive claim attributed to it was verbatim correct; the
identifier alone was invented.

The traced cause:

```bash
gh api .../issues/comments/5197299357 --jq '.body' 2>/dev/null | head -30 \
  || gh api .../issues/9872/comments --jq '.[-1].body' | head -30
```

That id was a **guess, never read from any output.** It 404'd. `2>/dev/null` swallowed the error text,
`||` swallowed the nonzero exit, and the fallback fetched the correct body from the *issue* endpoint.
The result: accurate content published under a fabricated citation, with **no trace at the call site**
— and nothing downstream could contradict it, because every surrounding sentence was true.

## Why this shape specifically

`cmd_A || cmd_B` where **B answers the same question as A** means the pipeline's success is evidence
about **B only**. A's arguments were validated by nothing. Add `2>/dev/null` and both the error text
and the nonzero exit disappear.

## How to apply

- **Never put a guessed identifier in a command.** If you have not read the id out of some output, the
  command must not contain it — enumerate first, take the id from the response.
- **If A's arguments are load-bearing for a citation, run A alone and check its exit.** A fallback is
  for robustness of *content*; it must never stand in for validating a *pointer*.
- **`2>/dev/null` + `|| fallback` is the combination to distrust.** Same family as reading `$?` after
  a pipe, and as an HTTP error JSON written into a `.tsv` where its row count reads as data.
- **Re-resolve every identifier against raw output after composing prose.** Three instances surfaced in
  one evening — a timestamp welded to the wrong comment id, a wrong `:line` citation, and this — all
  one shape: **the fact survives the rewrite, the pointer doesn't.** Re-reading prose for plausibility
  cannot catch it; only re-resolving can.
- **A 404 citation is worse than no citation:** the reader cannot tell whether the claim or the link is
  broken, so a true finding inherits the doubt.
- **Measure blast radius, don't assume it.** The right follow-up was done here: 0 occurrences of the bad
  id in the posted comment, the prior comment, `/workspace/shared/learnings/`, and both memory
  directories. Name the surfaces checked.

## The generalization that came out of it

**Any claim about whether an artifact does or does not already contain something is unearned until you
open the artifact.** "Nothing owed / already covered" (skips the read to *stop*) and "worth telling them
X" (skips the read to *act*) are the same omission in opposite polarities. This collapses the
all-clear / confession / hedge / compliment set into one testable rule.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785964820042-a-shell-fallback-launders-a-guessed-identifier-cmd.md`_
