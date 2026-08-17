---
title: "Prove a scan can fire before trusting its empty result"
type: learning
topic: misc
source: learnings/1786067498139-prove-a-scan-can-fire-before-trusting-its-empty-re.md
---

# Prove a scan can fire before trusting its empty result

## The shape

Four times on one task, across two independent agents, the same failure: **a negative claim resting on an empty scan, where nobody checked whether the scan could have produced a hit.**

Instances, all real:

1. `grep -oE '\b3[0-9]{4}\b'` over an upstream commit's diff → empty ⇒ "adds no 38xxx diagnostic IDs, so no collision with mine." Conclusion was right. Evidence proved nothing until the same grep was run over a diff *known* to add ID 38208 and returned it.
2. `find build/Debug/lib -name "libslang*.so" | head -1` then `strings | grep -c "<message>"` → 0 ⇒ "binary is stale." `head -1` had selected `libslang-llvm.so`, which never contains the string. A sentinel control also returned 0, exposing it.
3. A dead-code probe importing a *generic* helper against an exact-match local, so the import could never win ⇒ its `0` measured the fixture, not the compiler.
4. `gh run list --workflow retry-yielded-bot-ci.yml` → a clean, non-empty, *unrelated* result set, because both `ci-retry-yielded-bot.yml` and `retry-yielded-bot-ci.yml` existed (words transposed). "Last success five weeks ago" was indistinguishable from "wrong workflow."

## The rule

Before publishing any negative, zero, or count, run the **same predicate against an input that must produce a hit**. If it doesn't fire there, the zero means nothing.

```bash
# the claim
git diff A B -- file | grep -oE '<pattern>'          # -> empty

# the control that licenses it
git diff C D -- file | grep -oE '<pattern>'          # -> must be non-empty
```

The control belongs in the same run, on the same command, differing only in the input.

## Two generators worth naming separately

**Nondeterministic subject.** `find … | head -1` delegates the choice of *what is measured* to enumeration order. A probe whose subject is chosen nondeterministically cannot have a stable failure mode — so a sentinel ends up carrying the entire discriminating load. Pin the subject explicitly; then a control tells you about the measurement rather than about which file `find` happened to list first.

**The alarming reading is audited less.** Two of the four produced the *worrying* answer ("binary stale", "warning fires in dead code"). A finding that flatters your prior gets a second look; a finding that alarms you gets acted on. Both need the control.

## Corollary for scripts

A verification script must be validated on a **failing** arm, not just a passing one. Two arms that caught real defects here: substitute a wrong target (must fail loudly, not report a clean absent), and point it at a known-stale artifact (must refuse). Also exclude non-artifacts from artifact sweeps — a `.dwarf` split-debug file never contains program strings, so treating it as a sibling library makes the check impossible to pass.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786067498139-prove-a-scan-can-fire-before-trusting-its-empty-re.md`_
