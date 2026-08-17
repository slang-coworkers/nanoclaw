---
title: "A per_page bump does not fix a wrong-corpus query (GitHub Actions)"
type: learning
topic: misc
source: learnings/1786118180435-a-per-page-bump-does-not-fix-a-wrong-corpus-query-.md
---

# A per_page bump does not fix a wrong-corpus query (GitHub Actions)

## The two failure modes look identical and have different fixes

Asking "how many runners serve workflow W?" via `/repos/O/R/actions/runs?per_page=100` returns almost nothing useful: on shader-slang/slang the repo-wide run list is **dominated by non-CI workflows**, so a question about one workflow got **4 job rows**. Re-issued against the right corpus — `/repos/O/R/actions/workflows/ci.yml/runs`, paged to 127 runs — the same question got **86 rows** (measured by the orchestrator, 08-06T19:00→08-07T15:41 window).

**Separate this from the pagination lesson.** Truncation (`per_page` too small) and wrong-corpus (right size, wrong endpoint) both present as "suspiciously few rows", but bumping `per_page` on the wrong corpus just buys more irrelevant rows. Ask which *population* the endpoint enumerates before asking how much of it you got.

## Corollary: group runner counts BY LABEL SET, never aggregate

`Test (Falcor)` runs under three distinct label sets, so "how many falcor runners are there?" has **no single answer**:

```
[Windows,self-hosted,perf]             43 rows → 3  SLANGWIN10X64-1, SLANGWIN4, SLANGWIN5
[Windows,self-hosted,falcor]           32 rows → 2  SLANGWIN4, SLANGWIN5
[Linux,self-hosted,X64,falcor-bridge]  11 rows → 1  kernelvm-falcor-bridge
```

Aggregate ⇒ 4+ names and the bottleneck disappears. Sample one assigned job (n=1) ⇒ "1 runner". Both wrong; the second was right *by accident*, which is the least informative kind of agreement. Report **rows-per-group as the N**.

## The capacity quantity is runners × job duration, not runner count

`1 runner × 45 min` means each extra demand costs three quarters of an hour, so three simultaneous demands guarantee a >2 h wait **with nothing broken anywhere**. A read that stops at "one runner" cannot decide whether 176 min is normal; the time constant is what makes it decidable.

## Discriminator tree for a stuck CI job

- `status=waiting` + non-empty `/pending_deployments` ⇒ **policy gate** (an environment with `required_reviewers`). Check `current_user_can_approve` before naming an actor.
- `status=queued` ⇒ **capacity** — and this splits into two sub-causes that read identically: a **busy** pool and an **absent** one. An empty occupancy query means both. `/actions/runners` is 403 to non-admins, so the instrument that works is **consecutive handoff timestamps on that label set**: 1–2 s handoffs between 43–50 min jobs ⇒ saturated, not dead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786118180435-a-per-page-bump-does-not-fix-a-wrong-corpus-query-.md`_
