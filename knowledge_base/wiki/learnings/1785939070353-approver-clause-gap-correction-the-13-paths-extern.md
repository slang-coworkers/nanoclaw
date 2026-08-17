---
title: "[approver/clause-gap] CORRECTION: the 13 paths external/** uniquely protects contain zero .yml — they are the C++ implementation; and the two globs fail in opposite directions (.github/** under-reaches, **/*.yml over-reaches)"
type: learning
topic: review-approval
source: learnings/1785939070353-approver-clause-gap-correction-the-13-paths-extern.md
---

# [approver/clause-gap] CORRECTION: the 13 paths external/** uniquely protects contain zero .yml — they are the C++ implementation; and the two globs fail in opposite directions (.github/** under-reaches, **/*.yml over-reaches)

## Correction

Fixes a membership claim in
`[approver/clause-gap] Do not tidy external/** — it is the SOLE glob protecting the
gitlink…`. The *conclusion* of that note (`external/**` is the sole gitlink guard;
dropping it makes `no_protected_paths` pass clean) is verified and unchanged. The claim
about **which** paths depend on it uniquely was wrong.

I wrote that the 13 only-via-`external/**` paths "include all six added
`.github/workflows/*.yml` files." Matcher-executed, they include **zero** `.yml` files.

## Ground truth

```
glob_to_re('**/*.yml')   = ^.*[^/]*\.yml$      # UNANCHORED  -> matches at any depth
glob_to_re('.github/**') = ^\.github/.*$       # ROOT-ANCHORED
```

All seven workflow files are dual-matched — `['external/**', '**/*.yml']` — so they never
depended on `external/**` alone.

The actual 13, matched **only** by `external/**`:

```
src/metal/metal-buffer.cpp          src/metal/metal-buffer.h
src/metal/metal-buffer-address-map.h  src/metal/metal-command.cpp
src/metal/metal-device.cpp          include/slang-rhi/capabilities.h
tests/test-buffer-from-handle.cpp   tests/test-compute-indirect.cpp
tests/test-device-features.cpp      tests/test-ray-tracing-lss.cpp
tests/test-ray-tracing-clusters.slang  tests/test-ray-tracing-lss-inline-rq.slang
docs/api.md
```

## The correction strengthens the argument

What `external/**` *uniquely* protects is the **C++ implementation under review** — the
608 lines D3 is about, including `metal-buffer.cpp`, the file the BLOCK's
`fixupBufferDesc` evidence was read from. The workflow files were never solely dependent
on it.

So "don't tidy this glob" is a warning about **compiled-source exposure** (the general
hazard), not about CI files (the repo-specific one). Same pattern as the previous
correction: fixing the input changed *which mechanism was operative*, not just a number.

## The real content of the anchor lesson

The two globs fail in **opposite** directions, and neither behaves as its name suggests:

- `.github/**` **under-reaches** — root-anchored, so it misses
  `external/slang-rhi/.github/workflows/…` entirely.
- `**/*.yml` **over-reaches** — unanchored (and note `^.*[^/]*\.yml$` is loose enough
  that the `[^/]*` is nearly vacuous after `.*`), so it catches `.yml` at any depth.

Generalized: **a glob covers a path class only at the anchor it was written for, and
whether it is anchored is not visible from the glob's appearance.** `**/` at the start
consumes an optional separator and becomes `.*`; a literal prefix stays pinned to root.
Two patterns that look equally "recursive" behave oppositely.

## How to catch it

Never state which glob covers a path from reading the list. Print the matcher set per
path:

```python
{p: [g for g in policy["protected_paths"] if re.match(glob_to_re(g), p)] for p in paths}
```

Then compute uniqueness by set-equality on that matcher list (`== [candidate]`), not by
inspection. Also print the compiled regex — `glob_to_re('**/*.yml')` vs
`glob_to_re('.github/**')` side by side makes the anchoring asymmetry immediately visible
in a way the globs themselves do not.

## Meta — fifth instance, same shape

This is the fifth over-attribution in this session's chain and the second consecutive one
about glob membership. The pattern is stable: I get the *structural* conclusion right and
narrate the *supporting membership* from expectation rather than from the executed result.
The conclusion being correct is what makes the narration feel safe — a right answer
retroactively licenses the reasoning that reached it. Print the per-path matcher set;
don't describe it.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785939070353-approver-clause-gap-correction-the-13-paths-extern.md`_
