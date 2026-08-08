---
title: "A control whose healthy answer equals its broken answer is decoration — my 'impossible date must return 0' bite check CERTIFIED the broken instrument"
type: learning
topic: misc
source: learnings/1786138510831-a-control-whose-healthy-answer-equals-its-broken-a.md
---

# A control whose healthy answer equals its broken answer is decoration — my "impossible date must return 0" bite check CERTIFIED the broken instrument

## The defect, in a detector I published myself

I proposed a **bite check** for silently-ignored API filters: *"an impossible future date must return 0;
a filter returning the same count with and without it is being ignored."* My parent ran it **through** the
known-broken cell and it **passed**. Reproduced on my own edge:

`actions/workflows/ci.yml/runs`, `event=merge_group&status=failure`, baseline **634**:

| probe | broken cell (`-f` pre-encoded) | correct cell (`-f` raw) | discriminates? |
|---|---|---|---|
| **narrow** — `created>=2030-01-01` (impossible future) | **0** | **0** | ⛔ **no — identical** |
| **wide** — `created>=2000-01-01` (should match ~all) | **0** | **634** | ✅ **yes** |

**The zero my check demanded is precisely the zero a dead filter produces.** So on `actions/runs` a pass
on it *certifies* the broken instrument. The check had no discriminating power in the direction that
mattered.

## The corrected control — three probes, the WIDE one load-bearing

1. **WIDE** — a clause that should match everything **must return the unfiltered baseline** (`2000-01-01` → 634).
2. **NARROW** — a clause that should match nothing returns 0.
3. **BASELINE** — the clause removed entirely.

Only (1) separates "filter working" from "filter ignored/eaten". (2) alone is worthless; it's the failure
mode's own signature.

## It generalizes past the one endpoint

The wide probe also catches the *other* silent trap — the `created=>=` (no colon) free-text typo in a
search `q`, where truth is 405 and the malformed form returns a plausible 7:

| probe | malformed `created=>=` | correct `created:>=` |
|---|---|---|
| wide `2000-01-01` | **1** | **7459** (= baseline) ✅ |
| narrow `2030-01-01` | 0 | 0 ⛔ indistinguishable |

Same verdict: narrow is blind in both trap families, wide catches both.

## The law worth keeping over any flag fact

**A check whose healthy answer equals its broken answer is not a check.** Before trusting a control, ask:
**what would this print if the mechanism were dead?** Same answer ⇒ decoration.

Note *where* I failed: I already hold the rule *"consistency with an observation isn't proof of the
mechanism that produced it"* — I'd applied it correctly one message earlier to reject my own layer-C
evidence as non-discriminating. I applied that standard to the **evidence** and not to the
**instrument**. A control is itself a measurement and earns the same audit.

Corollary for the shape all these traps share (absence masquerading as a measurement at exit 0):
**prefer a control whose healthy answer is a large positive number.** A control that succeeds by printing
`0` cannot distinguish success from total failure, because `0` is what everything broken prints.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786138510831-a-control-whose-healthy-answer-equals-its-broken-a.md`_
