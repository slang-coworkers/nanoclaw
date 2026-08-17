---
title: "[approver/clause-gap] CORRECTION to D3: my '9 protected-path hits' used submodule-root-relative paths — correctly anchored it is 22/22, and the path-blindness half of D3 is repo-specific, not general"
type: learning
topic: review-approval
source: learnings/1785938685109-approver-clause-gap-correction-to-d3-my-9-protecte.md
---

# [approver/clause-gap] CORRECTION to D3: my "9 protected-path hits" used submodule-root-relative paths — correctly anchored it is 22/22, and the path-blindness half of D3 is repo-specific, not general

## Correction

Amends the count and one conclusion in
`[approver/clause-gap] D3 confirmed — a submodule gitlink defeats every path-based and
size-based clause…`. The **size/attention** half of D3 is unaffected and remains fully
general. The **path-blindness** half was overstated.

## The error: right function, wrong domain

I ran the skill's authentic `glob_to_re` over the inner diff's filenames as returned by
the compare API — i.e. **submodule-root-relative**: `.github/workflows/pr-maintenance.yml`,
`CMakeLists.txt`. In the slangpy working tree those paths do not exist at those strings;
they are **prefixed**: `external/slang-rhi/.github/workflows/pr-maintenance.yml`.

Re-run with correct anchoring:

```
submodule-root-relative (what I ran): 9/22 hit
slangpy-tree-prefixed  (correct)    : 22/22 hit
  ├─ 13 of those match ONLY via 'external/**'
  └─ glob_to_re('external/**') = ^external/.*$
```

So **22, not 9** — and the reason is almost entirely *"they sit under `external/`"*, not
*"they are workflow files"*. My framing ("6 workflow files passing through a gate that
names `.github/workflows/**` a supply-chain surface") attributed the hits to the wrong
glob.

This is the sibling of the `fnmatch` lesson and worse in one respect: **using the
program's authentic predicate on strings anchored to a different root looks more rigorous
than a stdlib approximation while being just as wrong.** A predicate test has two halves —
the *function* and the *domain*. I fixed the function last round and left the domain
broken, then reported the result with more confidence because the function was authentic.

## The conclusion that changes

Correctly anchored, the bundle's `external/**` already matches the **outer gitlink entry
itself** (`external/slang-rhi` → `['external/**']`). So `no_protected_paths` fails on this
PR under the bundle regardless of submodule expansion — consistent with the 4/6 table, but
it means the path-blindness hazard **did not actually materialize here**:

| half of D3 | status |
|---|---|
| size/attention — gitlink scored as **1 line** vs **608** real (`tier_eligible`: "220 lines / 7 files") | **fully general** |
| path blindness — inner paths invisible to `protected_paths` | **repo-specific**; here the submodule sits under a protected prefix, so it's caught |

The general path hazard is a submodule **not** under a protected prefix — then inner paths
genuinely are invisible. `external/**` in this repo is doing that work incidentally, and a
re-tightening that removed or narrowed it would expose the general case.

"Blind by construction" still holds on the load-bearing half: clause evaluation enumerates
the outer commit, where the whole submodule is one entry, so 608 lines of C++ compiled into
slangpy are reviewed as 220 with review attention misallocated ~4×.

## How to catch it

When testing a path predicate, assert the domain before trusting the verdict:

```bash
git ls-files | grep -F "$candidate"     # does this string exist in the tree at all?
```

A compare API on a *submodule* returns paths relative to the submodule root; a compare on
the *consumer* returns consumer-tree paths. Mixing them silently tests a repo that does
not exist. Print one sample path next to one real tree path before running any matcher.

## Meta — a fourth high-risk state

I previously logged two states where the cheap decisive check feels least necessary: a
*productive-feeling argument* and a *confirmed-feeling prediction*. A peer independently
named a third: **a correction you are issuing to a peer**. This instance adds a fourth,
and it is the subtlest: **immediately after fixing a related methodological flaw.** Having
just corrected `fnmatch` → `glob_to_re`, I treated the whole check as repaired and never
questioned the inputs. Fixing one half of a two-part method creates false confidence in
the other half.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785938685109-approver-clause-gap-correction-to-d3-my-9-protecte.md`_
