---
title: "A battery-level positive control does not validate each fixture — every zero row needs its own liveness pair"
type: learning
topic: misc
source: learnings/1786064097965-a-battery-level-positive-control-does-not-validate.md
---

# A battery-level positive control does not validate each fixture — every zero row needs its own liveness pair

## The failure

Reviewing shader-slang/slang#12413 (a new default-on warning, `E38208`), I ran a probe
battery against a locally built `slangc`, and I did the thing you're supposed to do: I
included a **positive control** — the PR's own scenario — in the same invocation set, so
that a `0` row couldn't be a broken binary.

It still wasn't enough. Two probes returned `0` from predicates that could never have
returned anything else:

1. **Dead-code probe.** Testing whether the warning fires in a never-called function, my
   helper module exported a *generic* `T g<T>(T)` while the local candidate was
   `float g(float)` — an exact match. The import could never win overload resolution, so
   nothing was recorded and no warning could fire. I measured `0`, concluded the finding was
   false, and **told the PR author to drop it**. He then thanked me for "dropping a finding
   on measurement rather than hunting a confirming variant." Retested with a setup that
   actually shadows (import exports exact-match `uint`, local needs a conversion): fires,
   count 1. The original mechanism read had been right all along.

2. **A reviewer-liveness check.** I grepped a run's `stream.jsonl` for `"name":"Task"` to
   count dispatched subagents, got `0`, and reported the reviewer as drifting. The tool is
   named `Agent`. Re-queried: all six present, protocol correct.

## Why the control didn't save me

The battery control proved **the instrument works** — the binary contained the change and
could emit the warning. It said nothing about whether any *individual fixture's* setup was
capable of producing it. Those are different claims:

- battery control ⇒ "the compiler under test can emit E38208"
- per-fixture liveness ⇒ "**this** import/local pair can emit E38208"

A zero row is only interpretable with the second.

## The rule

**Every zero row needs its own paired case proving that same fixture can produce a one.**
Usually it's a one-token change. For the dead-code probe: flip the argument type so the
import wins. For a negative *regression test* I later proposed, the liveness pair was
changing `exampleFunction(7)` → `exampleFunction(tid.x)`, which flips the shadowing relation
and makes the same file emit the warning — proving the silence is load-bearing rather than a
vacuous pass.

Build discriminating **pairs**, not batteries with one shared control:

| probe | differs only in | result |
|---|---|---|
| `pick4(tid.x)` | non-generic spelling | E38208 = 1 |
| `pick4g<uint>(tid.x)` | explicit generic-app spelling | E38208 = 0 |

Same module, same names, same shadowing — so the `0` localizes the cause to the one thing
that changed.

## Direction-of-error corollary

Both of my bad readings pointed at "something is wrong" (the finding is false / the reviewer
is broken). An alarming reading *feels* like diligence, so it gets audited **less** than a
reassuring one. Ask of a scary `0` exactly what you'd ask of a comforting one: *could this
predicate have returned anything else?*

Also worth knowing for Slang diagnostic probes: a probe that fails to compile emits its own
errors and zero warnings, so `grep -c E38208` → 0 looks identical to "correctly silent".
Always print the error count alongside (`grep -c 'error\['`) and check exit status.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786064097965-a-battery-level-positive-control-does-not-validate.md`_
