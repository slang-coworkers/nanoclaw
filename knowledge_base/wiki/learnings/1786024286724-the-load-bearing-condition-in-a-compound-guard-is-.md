---
title: "The load-bearing condition in a compound guard is routinely not the one that looks safety-critical"
type: learning
topic: agent-ops
source: learnings/1786024286724-the-load-bearing-condition-in-a-compound-guard-is-.md
---

# The load-bearing condition in a compound guard is routinely not the one that looks safety-critical

## The rule

When a maintainer asks you to drop conditions from a compound guard ("this shouldn't be so
special-cased — make it generic"), do **not** answer from which condition *sounds* safety-critical.
Enumerate what each condition actually excludes, find the live test that breaks, and cite it with its
severity. The answer inverts often enough that intuition is not evidence.

## The case

Guard in the Slang compiler: `isKhronosTarget(target) && stage == Stage::Fragment && isSVTargetSemantic(v)`.
The maintainer asked for "an `sv_` check and nothing else."

**My prior was wrong.** I'd have staked the answer on `isKhronosTarget` — it names the targets, I had
previously documented it as "a perfect gate," and the fact that Metal/WGSL derive locations through a
different pass made it feel like the thing preventing a second source of truth.

**Measured:** `Stage::Fragment` is load-bearing, and `isKhronosTarget` **cannot** save the breaking case
**because SPIR-V is itself a Khronos target** — that gate is true exactly when the damage occurs.

The mechanism was only visible upstream of the guard: for a system-value semantic there were three exit
paths, and all but two passed `directionMask = 0`, which produces no varying resource at all. So most of
the semantics the guard appeared to protect were *already* immune — the guard was never doing that job.
Exactly one shape (`SV_InstanceID` on a SPIR-V **vertex output**) took a path passing a real direction
mask, and it was the entire risk. Dropping the stage gate would break a live test with a **hard error**.

## How to run the check

1. **Enumerate what each condition excludes, separately.** A condition excluding nothing reachable is
   decoration. A condition uniquely excluding one shape is load-bearing.
2. **Look upstream for the real classifier.** A guard often re-filters something already filtered three
   functions away — *that* duplicate is the droppable one, and the non-duplicate is not.
3. **Name the failing test, then READ its severity.** "Breaks a test" and "emits a hard error" are
   different arguments. I checked `err(...)` vs `warning(...)` in the diagnostics table rather than
   assuming — and the *immediately preceding* diagnostic was a `warning(`, so glancing at the neighbour
   would have supported the wrong claim. Adjacency is not evidence.
4. **Treat an inner guard separately.** The inner one here used a `findOrAddResourceInfo`-style call that
   **creates** the entry it checks for. A guard whose removal *manufactures* the state it was testing is
   never cosmetic.

## Why it matters

The "stop special-casing this" ask is usually well-founded — reviewers are right that special cases rot.
The failure mode is answering it with prose about which gate feels principled: that yields a reply, not
a resolution, and the ask stays open (the companion failure: *a reply is not a change*).

Measuring buys you a third option neither side proposed. Here: keep both gates, but replace the **exact
string match** with the generic prefix test the file already used elsewhere — killing the special case
the maintainer objected to while keeping the conditions that carry real semantics. That is a resolution,
and it only exists because the guard got measured instead of argued about.

**Bonus:** auditing a guard for a *proposed* change is the cheapest moment to discover the *shipped* one
is already incomplete. The same sweep found a pre-existing shape that hits the identical hard error today.
Check whether any test exercises it before calling it a regression — none did, so it is a PR-body
disclosure, not a fire.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786024286724-the-load-bearing-condition-in-a-compound-guard-is-.md`_
