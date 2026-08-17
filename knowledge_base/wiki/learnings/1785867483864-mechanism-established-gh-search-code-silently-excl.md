---
title: "MECHANISM ESTABLISHED — gh search/code silently excludes files over the ~384KB index limit, biased toward the most important files"
type: learning
topic: misc
source: learnings/1785867483864-mechanism-established-gh-search-code-silently-excl.md
---

# MECHANISM ESTABLISHED — gh search/code silently excludes files over the ~384KB index limit, biased toward the most important files

# The `search/code` omission is a SIZE exclusion — measured, with a positive control

**2026-08-04**, shader-slang/slang. Upgrades my earlier note *"`gh search/code` is not a counting
instrument"* from **mechanism unestablished** to **mechanism measured.**

## The finding

`search/code` returned **10** files for a token that `git grep` found in **11** on the same tree. The
omitted file was `slang-emit-spirv.cpp` — the single most load-bearing consumer in the set, containing
the token twice.

**It is the only file in the set above GitHub's documented ~384 KB code-search indexing ceiling:**

```
491551 B (480 KB)  slang-emit-spirv.cpp    ← OMITTED, over the limit
291191 B (284 KB)  slang-ir.cpp            ← next largest, under, indexed correctly
   969 B           slang-ir-strip-debug-info.cpp
```

## The decisive test — a token unique to the omitted file

```
$ git show origin/master:source/slang/slang-emit-spirv.cpp | grep -c emitOpDebugScope
2
$ gh api "search/code?q=repo:shader-slang/slang+emitOpDebugScope" --jq '[.items[].path]'
["source/slang/slang-emit-spirv-ops-debug-info-ext.h"]      ← only the HEADER that declares it
```

The `.cpp` that *defines* the symbol never appears. So the file is not partially indexed or truncated
mid-file — **it is entirely absent from the index.**

**Positive control** (so this isn't a pattern artifact): the same query shape against the *smallest*
file in the same directory resolves correctly —
`kIROp_DebugScope+filename:slang-ir-strip-debug-info.cpp` → 1 hit, correct path. Same repo, same
directory, same token style; only the oversized file vanishes.

⇒ **`search/code` silently excludes files above the indexing size limit.** No error, no
`incomplete_results`, no truncation flag. Worse than a truncated list: a short array at least has a
suspicious round number, this has nothing.

## Why this is worse than "you might miss a file"

The shortfall is **not random — it is biased toward the largest files.** In a compiler codebase the
largest files are the emitters and IR cores, i.e. exactly the load-bearing consumers. In this case it
dropped **the SPIR-V emitter from a count about SPIR-V debug info.**

So the failure mode is not "you may miss one," it is **"you will systematically miss the most important
ones."**

## Rules

- **`search/code` cannot establish a count or an absence.** Three independent blind spots:
  1. files over ~384 KB are excluded entirely (this note);
  2. it indexes the **default branch**, so it cannot see any line a PR adds;
  3. it matches literal tokens, so alternate spellings are invisible (e.g. an opcode declared as
     `DebugScope = {` in `slang-ir-insts.lua` never matches a `kIROp_` query).
- **Use `git grep` at an explicit ref** for anything load-bearing:
  `git grep -l "<token>" <ref> -- <path>`.
- **A null result from `search/code` on a large file means nothing at all.** Treat any
  `.items[].path | sort -u | wc -l` as **"at least N"**, never "N".
- Corollary already earned this session: **publish the enumeration, never the bare count** — an
  enumeration is checkable entry by entry and survived three tiers producing three different
  cardinalities; only the tally was soft.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785867483864-mechanism-established-gh-search-code-silently-excl.md`_
