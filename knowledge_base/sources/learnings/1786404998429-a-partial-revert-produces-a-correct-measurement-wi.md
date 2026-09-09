---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378659588-1lakxw
written_at: 2026-08-10T23:36:38.429Z
---

# A partial revert produces a correct measurement with the wrong label — verify the baseline by file set, not by intent

## TL;DR

When you revert "the fix" to measure a pre-fix baseline, you revert **a file set**. If that set is
incomplete, you don't get a broken measurement — you get a **real, reproducible, internally consistent
measurement of a different cell**, labelled as the baseline. That is worse than a failed measurement,
because a failure announces itself and a mislabel doesn't.

**Mechanical guard:** after reverting, `git diff --stat` against the base must be **empty**. Enumerate
the file set from `git diff --name-only <base>..HEAD`, not from memory of what you changed.

## The measurement (shader-slang/slang#12440, 2026-08-10)

My fix touched **six** source files: one checker (`slang-ir-string-hash.cpp`), one pass-ordering change
(`slang-emit.cpp`), and four emitters (`slang-emit-{c-like,llvm,spirv,wgsl}.cpp`). To get a pre-fix
baseline I reverted the first two — the ones I thought of as "the fix" — and rebuilt.

The result was plausible and I was about to report it as pre-fix:

```
"PRE"  hlsl   rc=255  E99999
"PRE"  glsl   rc=255  E99999
"PRE"  metal  rc=255  E40100
```

It was not pre-fix. It was the **emitter-only cell** — the four emitter casts were still present — and
as a measurement of *that* cell it was entirely correct. Nothing about the numbers was wrong. Only the
label was, and the label was what made it evidence for a claim it could not support.

The true baseline, with all six reverted (`git diff --stat` empty), is different:

```
TRUE-PRE  hlsl   E99997  assert slang-ir.cpp(2253)
TRUE-PRE  glsl   E99997  assert slang-ir.cpp(2253)
TRUE-PRE  metal  E40100  assert slang-ir.cpp(2253)
```

## What caught it — and why that's the uncomfortable part

Not a control I had designed. An **unexpected value**: I expected the debug assert in `getStringSlice`
and saw `E99999` instead, which only looked wrong because I happened to have a strong prior about what
pre-fix HLSL does. Had I lacked that prior, or had the two cells produced the same diagnostic, the
mislabelled baseline would have gone into a PR body as the "before" column.

So the honest summary is: **the surprise was the instrument.** That is not a repeatable safeguard, which
is exactly why the mechanical `git diff --stat` check is worth doing every time — it costs one command
and does not depend on having a prior.

## How to apply

- **Derive the revert set from the diff, not from your mental model of "the fix."** A change that grew
  across review rounds (mine gained four emitter files after a reviewer finding) will have files you no
  longer think of as part of it.
  ```bash
  git diff --name-only <base>..HEAD          # the authoritative set
  for f in $(git diff --name-only <base>..HEAD); do git show <base>:"$f" > "$f"; done
  git diff --stat                            # MUST be empty before you trust the build
  ```
- **Restore with `git checkout -- <paths>`, never `git stash`.** In a multi-worktree clone the stash is
  shared and `pop` can consume a sibling agent's entry.
- **Label every A/B cell by its file set**, e.g. `checker-cast-only (2/6 files)` rather than `pre-fix`.
  If a matrix column can't be named by what's in it, the column is not defined.
- **When two cells could produce the same output, add a discriminator you can check** — a marker in the
  build, a version echo, a file hash — rather than relying on the outputs differing.
- Related and the same family: a binary's version string is not artifact identity. Before trusting a
  build as "pre-fix," confirm its *tree* carries the pre-fix properties (e.g. grep the specific line
  that the fix changes).

## Generalization

This is the mirror of the more familiar trap "the measurement failed and I didn't notice." Here the
measurement **succeeded** and measured the wrong thing. Any experiment defined by *removing* something
— a revert, a feature flag, a disabled pass, an unset env var — is exposed: the removal is a set
operation, and set operations fail partially without erroring. Ask "what exactly is in the state I just
built?" and answer it with a command, not with recollection.
