---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T19:36:31.681Z
---

# [approver/challenger-miss] CORRECTION to my own earlier leaf: "grep -rn '&name' is the whole ABI check" is WRONG for a public header — it scopes to this repo only

## What this corrects

Earlier the same day I filed
**"[approver/challenger-method] Measure a linkage/ODR claim by symbol BINDING
(readelf -sW), not by the language rule"** (from slang#12452). Its measurement
guidance is correct and stands. But it contains an over-claim I must retract
before someone applies it:

> "**The safety predicate is a one-line grep.** … `grep -rn '&<name>' .`
> — 0 hits => the ABI question is answered"

**That is wrong when the declaration lives in a public header.** A repo-scoped
grep answers "does *this project* take the address", never "does *any caller*".
`include/slang.h` is consumed by out-of-tree code that cannot be enumerated, so
0 hits does not answer the ABI/source question — it answers a narrower one that
merely looks like it.

I discovered this because a DECISION_REVIEW critique challenged the scope of that
very evidence on #12452 and **reversed my WOULD_APPROVE** to
`ABSTAIN_POLICY:CHALLENGER_CONCERN`. The leaf was written while I still believed
the approve, so the bad predicate got recorded as if validated by a clean outcome.

## The substance I had missed

Internal linkage makes the entity **per-TU**, so it changes **address identity** —
which the emission/binding table I was so pleased with does not show. Measured
across two TUs:

- comparing `&kInvalidCoverageCounterIndex` across TUs: `same=1` → **`same=0`**
- address as a non-type template argument: one type → **distinct types per TU**
- address odr-used from a downstream inline function: well-formed → **IFNDR**,
  and my test for it **silently printed `same=1`** (the linker folded one
  definition), i.e. it passed by luck and carried zero bits

## Corrected rule

For a linkage change, there are **two** questions and the grep answers neither
completely:

1. *Does it emit a cross-module symbol?* → `readelf -sW` bindings
   (`WEAK`/`UNIQUE` vs `LOCAL`). The original leaf's method is right here.
2. *Does it change address identity for callers?* → two-TU address comparison
   plus a non-type-template-argument test. **If the declaration is in a public
   header, this question cannot be closed from inside the repo at all** — the
   honest output is a scoped claim ("no in-tree use takes the address") plus an
   abstain routing the compatibility judgment to a human who can weigh the
   installed base.

## Meta-lesson (the reason this correction exists)

**A leaf written while an approve still stands inherits the approve's blind spot.**
The bad predicate read as validated because the decision it supported had not yet
been challenged. Two guards:

- **Audit your own wording for coverage promotions.** "*The whole* ABI check",
  "*the* safety predicate", "0 hits ⇒ answered" are claims about **coverage**, and
  coverage is precisely what a grep cannot attest. That phrasing is the audit
  trigger, and it was sitting in my own text.
- **When a decision reverses, re-grep the learnings you filed under the old
  conclusion.** A correction is not done until the claim's *other phrasings* are
  fixed — including the ones in a different artifact, filed minutes earlier, that
  now read as authoritative because they are in the shared store.
