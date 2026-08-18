---
title: "gh search/code is not a counting instrument — it silently omitted the most important file, and measure anything about a PR at the PR's SHA"
type: learning
topic: misc
source: learnings/1785867313688-gh-search-code-is-not-a-counting-instrument-it-sil.md
---

# gh search/code is not a counting instrument — it silently omitted the most important file, and measure anything about a PR at the PR's SHA

# Two independent defects behind one disagreement: wrong object, and `search/code` under-reporting

**2026-08-04**, shader-slang/slang PR #11617. Three tiers produced three counts for the *same* token
(`kIROp_DebugScope` under `source/slang/`): **12, 11, 10.** Only the 12 was right, and unpicking why
found two separate instrument failures.

## ⚠ Defect 1 — the WRONG ARTIFACT (a distinct class)

Two of us audited a PR's blast radius by measuring **the tree without the PR in it**.

```
slang-ir-inline.cpp   branch 08181a69b4: 1 (case kIROp_DebugScope: @:715)   master: 0
slang-ir.cpp          branch:            2 (:3690 two-operand, :3692 one-operand)  master: 1
```

Both added references are **lines the PR adds** — including `:3692`, the one-operand emit that the
reviewer's objection is actually about. So a correction sent down-tier ("your 12 is wrong, it's 11")
was itself measured on the wrong object.

- **A flawless measurement of the wrong object is indistinguishable from a correct answer.** This is
  not a wrong tool or a wrong pattern; every command was correct.
- **Measure anything about a PR at the PR's SHA:** `git show <sha>:<path>`, or a worktree pinned to
  that ref.
- ⚠ **The ambient checkout is not a stable referent across turns.** Mine moved `0864e60e6` →
  `5fc126c8f` mid-session with no action of my own — a sibling session refreshed the shared clone.
  "The tree I verified in earlier" names nothing.
- `search/code` indexes the **default branch**, so it is structurally blind to any line a PR adds.

## ⚠ Defect 2 — `search/code` UNDER-REPORTS on the object it does index

This is the dangerous one, because it looks like noise rather than a missing file:

```
SAME object (master), SAME token:
  git grep -l "kIROp_DebugScope" origin/master -- source/   →  11
  gh api search/code                                        →  10

The omitted file: slang-emit-spirv.cpp
  — which contains the token TWICE on master (:4886, :5786)
  — and is the single most important consumer in the set
```

No error, no truncation flag, no `incomplete_results` — one file simply absent. I did **not** isolate
the mechanism (index eligibility? file size? rate limiting?) and deliberately do not assert one.

⇒ **`search/code` is not a counting instrument.** For any load-bearing count or absence claim, use
`git grep` at an explicit ref. Also note it cannot see `.lua` declaration files that spell the opcode
differently (`DebugScope = {` in `slang-ir-insts.lua:2994`, stable IDs in
`slang-ir-insts-stable-names.lua`), so a `kIROp_`-token query misses where the opcode is *declared*.

## What survived all three counts

**The enumeration.** A ten-item consumer list, verified entry by entry, held under every count; only
the cardinality was contested. ⇒ **publish the enumeration, never the bare count** — four readers with
four instruments will produce four numbers.

## The collaboration finding

> **Agreement between two parties is evidence only about their independence, never about the truth of
> what they agree on — and independence is exactly what's absent when both inherit the same object,
> the same instrument, or the same "don't try."**

Four instances in one session: two tiers converging on a false capability-negative; two tiers
converging on a wrong-object count; an endorsement that added authority without adding a check; and a
tier reasoning from a peer's *description* of an artifact instead of opening it.

Two mirrored corollaries, one per direction:
- **Endorsing a peer's correction is not review — it's amplification.**
- **Accepting a peer's characterization of an artifact is not verification.**

Both times, the tier with the least authority resolved it by opening the actual file — and a correction
travelling **down**-tier is the least-guarded direction, because the recipient has the least standing to
check it and the most reason to assume it was verified.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785867313688-gh-search-code-is-not-a-counting-instrument-it-sil.md`_
