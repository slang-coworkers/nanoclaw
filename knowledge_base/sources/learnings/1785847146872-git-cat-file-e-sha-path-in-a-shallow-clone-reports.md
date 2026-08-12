# `git cat-file -e <sha>:<path>` in a SHALLOW clone reports FAKE ABSENCE — a missing commit is indistinguishable from a missing file; use ls-tree on the commit or the commits API

# A file-existence probe at an unfetched commit answers "absent" for the wrong reason

Hit while verifying a PR-description staleness claim on shader-slang/slang#12322
(2026-08-04), in a container whose `slang` clone was populated by targeted
`git fetch origin <sha> --depth=1` calls.

## Symptom

To check whether a helper's header existed at an earlier revision and was later
removed, I ran the natural probe:

```bash
git cat-file -e 5720ea9e32039ae2b1962300805c1fc6c75fd294:tools/slang-test/slang-test-backend-requirements.h \
  2>/dev/null && echo PRESENT || echo absent
```

Result: `absent`. Which was **wrong, and confidently so** — a bot review on that
very commit had quoted line 38 of that exact file, so absence was implausible.

## Root cause

The commit itself was never fetched into the shallow clone:

```bash
$ git cat-file -t 5720ea9e32039ae2b1962300805c1fc6c75fd294
fatal: git cat-file: could not get object info
$ git ls-tree --name-only 5720ea9e3203 tools/slang-test/
fatal: not a tree object
```

`cat-file -e <sha>:<path>` collapses two very different failures into one exit
code: **"that path is not in that tree"** and **"I don't have that tree at all."**
With `2>/dev/null && echo PRESENT || echo absent` — the idiomatic one-liner — the
distinguishing stderr is thrown away and both render as a clean `absent`.

This is the same class as the 1 MB `contents` trap (`encoding=none` ⇒
`base64 -d | grep -c` prints a confident `0`): **a probe whose negative answer is
produced by a missing input rather than by a real absence.** Those negatives have
no failure signature — nothing looks broken.

## How to catch it

Always prove the *container* of the probe exists before trusting a negative:

```bash
git cat-file -t <sha>            # must print "commit"
git ls-tree --name-only <sha> -- <dir>/   # must list something
```

A zero/absent result without that control is not evidence. General rule I already
hold and re-learned here: **a zero-hit result needs a must-be-non-zero control on
the same instrument.** For a shallow clone, the control is on the *commit*, not
the path.

## The reliable methods (both name-checked)

1. **Fetch first, then probe:** `git fetch origin <sha> --depth=1`, confirm
   `cat-file -t` says `commit`, then `git ls-tree`/`git show`.
2. **Skip the clone entirely — ask the API what the commit changed:**
   ```bash
   gh api repos/<owner>/<repo>/commits/<sha> --jq '.files[] | "\(.status) \(.filename)"'
   ```
   This is strictly better for *lifecycle* questions, because it returns
   `added` / `modified` / `removed` per file — the actual question — instead of
   requiring two existence probes at two revisions and inferring the transition.

Applied to #12322, method 2 settled it in two calls:
- `a38ed3519764` → `added tools/slang-test/slang-test-backend-requirements.h`,
  `added tools/slang-unit-test/unit-test-slang-test-backend-requirements.cpp`
- `eb64b1292b4f` → `removed` both

⚠️ Note this also corrected a *path* I had recorded from memory: the unit test
lives at `tools/slang-unit-test/…`, not `tools/unit-test/…`. My probe had the
wrong directory too — so even in a full clone that one-liner would have printed
`absent` for a second independent wrong reason. **Two error sources, one
indistinguishable output.** Independent confirmation that the helper is genuinely
gone at the head came from a grep *with* a positive control:
`git grep -c "_addForcedBackendRequirements\|getForcedDownstreamBackend"` = 0 while
`git grep -c "_hasOption"` = 3 on the same file at the same sha.

## Fix

For "did file F exist at commit C" in a shallow clone: use the commits API, or
fetch C and verify with `cat-file -t` first. Never accept a bare `absent` from
`cat-file -e <sha>:<path>` — and when you write the one-liner, don't discard
stderr, since `fatal: not a tree object` is the whole answer.
