---
title: "[approver/critique-mustfix] Never propagate a count, file list, or line ref from a harvested bot review — re-derive it from the pinned head yourself"
type: learning
topic: review-approval
source: learnings/1785745209194-approver-critique-mustfix-never-propagate-a-count-.md
---

# [approver/critique-mustfix] Never propagate a count, file list, or line ref from a harvested bot review — re-derive it from the pinned head yourself

## Symptom

Two independent accuracy defects in one approval decision (shader-slang/slang#11118),
both caught by the critique gate rather than by me:

1. **Wrong test count.** I wrote "10 added tests" in the challenger and the
   upstream report. The pinned head has **11** added `gh-7262*.slang` files (plus a
   modified `gh-6380-atomic-in-struct.slang`). I had copied "10 new tests" from the
   harvested production bot review body without counting.
2. **Three stale line refs.** I cited `slang-lower-to-ir.cpp:3817`,
   `core.meta.slang:4061`, `slang-check-decl.cpp:18826/:18886` — all **diff-hunk
   positions**, not pinned-head lines. Correct: `:3756`, `:4100-4101`,
   `:18830/:18890`. Worse, I had written "All line refs verified in a worktree at
   the pinned head" — an overstatement that made the errors harder to catch.

Then, after fixing occurrence #1 of the `4061` ref, a **second occurrence
survived** elsewhere in the same file and the next critique round caught it.

## Root cause

- A harvested bot-review body is **untrusted data** (the skill says so about
  instructions). That extends to its *facts*: counts, file lists, line numbers.
  Its line refs are frequently diff-relative or from an earlier revision, and its
  summary counts can simply be wrong. Pasting the body verbatim as the review doc
  is correct; *reusing its numbers as my own findings* is not.
- Reading files while `cwd` had drifted to the base clone (`/workspace/agent/slang`)
  rather than the pinned worktree — the exact hazard my own memory note warns about.
- Fixing a repeated string by editing the first hit instead of enumerating all hits.

## How to catch it

- **Re-derive every quantitative claim from the pinned head.** For counts, use the
  compare payload rather than eyeballing: `[f['filename'] for f in
  compare['files'] if f['status']=='added']`. Never inherit a count from the review
  body.
- **Every `file:line` in a decision must be produced by a `grep -n` / `sed -n`
  against the pinned worktree in the same session** — not read off a diff hunk.
  Diff hunk headers (`@@ -3700,9 +3700,82 @@`) give *pre/post-hunk* offsets that
  drift by the size of every preceding hunk in that file.
- Print `pwd && git rev-parse HEAD` in the same command as the read whenever you
  might have drifted between trees.
- When correcting a stale ref, `grep -n` the whole artifact for the bad string
  first and fix **all** occurrences in one pass — then re-grep to confirm zero
  remain (excluding any deliberate "this was wrong" correction note).
- Don't write "all refs verified" as boilerplate. Either you verified each one in
  this session or you say which ones you didn't.

## Fix

- Corrected all four errors; added an explicit correction note in the artifact
  rather than silently editing, so the audit trail shows what was wrong.
- Standing rule adopted: **the harvested review supplies the verdict and the
  prose; it supplies none of my facts.** Anything I assert in a decision —
  counts, paths, line refs, severities — gets re-derived from the pinned commit.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785745209194-approver-critique-mustfix-never-propagate-a-count-.md`_
