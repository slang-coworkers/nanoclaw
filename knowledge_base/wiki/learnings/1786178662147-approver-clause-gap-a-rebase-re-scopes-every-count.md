---
title: "[approver/clause-gap] A rebase re-scopes every count and inverts staleness discriminators — post-rebase slangpy#1090 has 6 files/218 lines and NO gitlink, so 22-vs-24 was the wrong population entirely"
type: learning
topic: slang-compiler
source: learnings/1786178662147-approver-clause-gap-a-rebase-re-scopes-every-count.md
---

# [approver/clause-gap] A rebase re-scopes every count and inverts staleness discriminators — post-rebase slangpy#1090 has 6 files/218 lines and NO gitlink, so 22-vs-24 was the wrong population entirely

## Symptom

Two tiers argued 22 vs 24 files on a PR whose actual file count is **6**. Both numbers
described the *submodule* compare; neither described the PR. Verified at R4 head
`f906a11983f8`:

```
compare/main...f906a11983f8  ->  6 files, 218 lines, gitlink? False
  slangpy/tests/device/test_buffer_from_native_handle.py  +74/-0
  src/sgl/device/device.cpp                               +5/-0
  src/sgl/device/device.h                                 +9/-0
  src/sgl/device/resource.cpp                             +90/-29
  src/sgl/device/resource.h                               +2/-0
  src/slangpy_ext/device/device.cpp                       +9/-0
```

Matches the recorded clause evidence exactly (`6 changed path(s)`, `218 lines / 6 files`).

**The rebase dropped the `external/slang-rhi` gitlink from the PR's diff.** So the whole
22/24 dispute was about a population that is no longer part of the change under review,
and the D3 undercount that dominated earlier rounds **does not apply to this revision at
all** — there is no gitlink to under-count.

## Three ways a rebase silently re-scopes prior conclusions

1. **Counts change population, not just value.** "N files" is meaningless without naming the
   compare that produced it: single-commit (`parents[0]...head` → 2 files here), PR-level
   (`main...head` → 6), or submodule (`old...new` → 22). All three are "the file count."
   State the range with the number.
2. **Staleness discriminators can invert.** Pre-rebase, a stale analysis was one that
   *missed* the gitlink; post-rebase, with no gitlink in the diff, **rendering one at all
   proves staleness**. A discriminator's polarity is a property of the revision, not of the
   tool — re-derive it each round instead of reusing it.
3. **"N heads stale" becomes ill-defined.** A human review pinned to a pre-rebase sha now
   points at a commit that is no longer an ancestor, so the distance is undefined rather
   than large. Report "pinned sha not in current history" instead of a number.

## The right instrument for "does a prior finding survive a rebase"

Not re-reasoning, and not re-running the whole analysis: **compare per-file blob SHAs across
the rebase.** A byte-identical blob means a file-scoped finding applies verbatim; a changed
blob means re-read that file only. Cheap, decisive, and it scopes the re-verification to
exactly what moved.

## What re-verification found (and why not to inherit it)

The 3-of-4 size gap was re-grepped at the **new** pin `8ffe21c501b2`, not inherited:
metal compares `desc.size > nativeBuffer->length()`; vulkan, d3d12, wgpu have no size
comparison on the `createBufferFromNativeHandle` path. Unchanged conclusion, independently
established at the current pin — which is the only way to know a gap wasn't fixed by the
same bump that moved it.

## Related trap: a bot attributes upstream code to the PR that rebased onto it

A review bot flagged a hunk in `device.cpp` that belongs to a *different* commit the PR
merely rebased onto. Confirm ownership before treating a bot finding as in-scope: the PR's
own hunks vs the flagged line range. Genuine-looking concern, wrong PR — and a rebase makes
this failure mode routine rather than rare.

## Naming rule reinforced

An earlier warning implied `eval-clauses.py` was defective for using a diverged file list.
It isn't — it diffs `base_ref...sha` correctly and reported 6/218. The vulnerable step was a
**human hand-feeding it a list**. *Name the vulnerable step, not the whole tool*: the
difference decides whether someone patches code or changes a procedure.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786178662147-approver-clause-gap-a-rebase-re-scopes-every-count.md`_
