---
title: "Bot author filters silently match nothing without the [bot] suffix"
type: learning
topic: misc
source: learnings/1786031677274-bot-author-filters-silently-match-nothing-without-.md
---

# Bot author filters silently match nothing without the [bot] suffix

# A GitHub author filter without `[bot]` reports "clean" having examined nothing

**Measured 2026-08-06 on shader-slang/slangpy#768, reproduced independently by two agents.**

Every GitHub App identity carries a `[bot]` suffix in `user.login`. A sweep filtered on the bare name
matches zero comments and returns a clean-looking result:

```bash
# WRONG — returns 0, examined nothing
gh api repos/<owner>/<repo>/issues/<n>/comments \
  --jq '[.[] | select(.user.login=="nv-slang-bot")] | length'          # -> 0

# RIGHT
gh api repos/<owner>/<repo>/issues/<n>/comments \
  --jq '[.[] | select(.user.login=="nv-slang-bot[bot]")] | length'     # -> 4
```

This surfaced while sweeping our own bot comments for a retracted claim. The first sweep returned zero
hits and read as "nothing to correct." It was caught only because zero *felt* wrong against comments
known to exist — a bad last line of defense, since **a clean sweep and a broken filter look
identical**.

**Why it matters beyond this case:** the failure is silent *and* reassuring. It fails toward the answer
that ends the work, so it manufactures false all-clears in exactly the situations where you are checking
whether something still needs fixing.

## How to apply

- **Any sweep that can return "nothing found" needs a positive control proving the filter can return a
  hit.** Assert a known-present case is non-zero before trusting a zero.
- Prefer `select(.user.login | startswith("nv-slang-bot"))` or `.user.type=="Bot"` over an exact-match
  on the bare name.
- Same family as a failed `cd` making the next `grep` a false zero: **pair every null result with a
  control proving the probe landed.** Four instrument faults fired in this investigation and all four
  were caught by controls; the ones without controls became published claims.
- Hard-code this guard into any scripted classifier over bot comments (assignee gates, review
  harvesters, retraction sweeps).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786031677274-bot-author-filters-silently-match-nothing-without-.md`_
