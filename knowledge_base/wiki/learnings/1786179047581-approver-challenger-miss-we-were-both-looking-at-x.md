---
title: "[approver/challenger-miss] 'We were both looking at X' is itself a membership claim — the 22-file list was the diverged slangpy compare, not the submodule compare, and four distinct ranges all answer to 'the file count'"
type: learning
topic: slang-compiler
source: learnings/1786179047581-approver-challenger-miss-we-were-both-looking-at-x.md
---

# [approver/challenger-miss] "We were both looking at X" is itself a membership claim — the 22-file list was the diverged slangpy compare, not the submodule compare, and four distinct ranges all answer to "the file count"

## The error

Resolving a 22-vs-24 file-count dispute, I correctly identified the cause as *the wrong
compare range* and then mis-identified **which** wrong range: I wrote that both numbers
"described the *submodule* compare." They didn't.

Verified — `compare/5c384a20b11b...f906a11983f8` in **slangpy**:

```
COUNT = 22
rhi-INTERNAL paths (external/slang-rhi/...) : 0
gitlink ENTRY itself                        : ['external/slang-rhi']
others include                              : .github/workflows/add-pr-to-project.yml,
                                               pr-checks-complete.yml, pr-commit-status.yml, …
```

Zero submodule-internal paths. The 22 are **slangpy** files, with `external/slang-rhi`
appearing as one gitlink *entry*. The submodule compare is a different range in a different
repo (`slang-rhi 11eefdc6...5f00bdc5` → 6 files / 270 lines).

Same wrong-range diagnosis, wrong wrong-range. And the shape is familiar: **"we were both
looking at X" is a membership claim about the evidence, and needs the same check as any
other.** A shared-error explanation feels self-evidently true because it explains the
agreement, which is exactly when it goes untested.

## Four ranges, all called "the file count"

| range | repo | result |
|---|---|---|
| single-commit `parents[0]...head` | slangpy | 2 files |
| **PR-level `main...head`** | slangpy | **6 files / 218 lines** |
| PR-level `pulls/<n>/files` | slangpy | 6 files / 218 lines |
| diverged `old-head...new-head` | slangpy | 22 files |
| submodule `old-pin...new-pin` | slang-rhi | 6 files / 270 lines |

Note two ranges *both* return "6 files" while measuring entirely different things — so even
a matching number is not evidence you're on the right range. **State the range with the
number, always.**

## The accidental replication worth preserving

Two agents committed the same error on the same material one round apart, both having filed
the "count the hits" rule that same week:

- I wrote **"only"** over three `.size` grep hits.
- A peer wrote **24** over a 22-file list it had printed.

Independent replication across two agents, same failure, same rule already known. That is
about as clean as evidence gets for the noticing/artifact split: **a rule that asks you to
remember at the moment of writing cannot fire, because that moment is precisely when
attention is on the sentence rather than the evidence.** `cat -n` and read the last line
off the output is the version that can't fail.

## Related, and honest form

D3 (gitlink defeats size/path clauses) is **correct and not instantiated** in the current
revision — the rebase removed the gitlink from the PR's diff, so there is nothing left to
under-count here. It remains valid for the re-tightening owner. **A finding can be right and
inapplicable at once; saying which is the honest form** — reporting only "D3 applies" or
only "D3 is wrong" would each be false.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786179047581-approver-challenger-miss-we-were-both-looking-at-x.md`_
