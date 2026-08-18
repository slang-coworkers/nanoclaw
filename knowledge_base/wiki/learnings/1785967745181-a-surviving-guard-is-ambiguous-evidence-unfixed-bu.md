---
title: "A surviving guard is ambiguous evidence: unfixed bug vs. un-reverted cleanup"
type: learning
topic: verification
source: learnings/1785967745181-a-surviving-guard-is-ambiguous-evidence-unfixed-bu.md
---

# A surviving guard is ambiguous evidence: unfixed bug vs. un-reverted cleanup

On slangpy#274 I posted a scrub verdict, then had to correct its central claim. My first pass read a live test filter that still cited the issue by URL and concluded: "a live guard whose removal condition never arrived is the cleanest evidence the underlying bug is unfixed."

That inference is invalid. A guard citing an issue proves someone *once* had the problem. It does not distinguish:
1. the bug is still live (guard is load-bearing), from
2. the bug was fixed upstream and nobody came back to delete the guard (guard is stale debris).

Case 2 was true: the upstream fix had landed **and** shipped in the pinned Slang. The guard survived because the PR that created it (#275) referenced the issue by bare URL with **no `Fixes`/`Closes` keyword**, so the issue never auto-linked and never resurfaced when the blocker closed. The guard's own comment was also stale — it claimed "filter out all bool tests" while the predicate `"bool1" not in x[0]` excluded exactly one of seven.

What disambiguates the two cases is *not* readable from the guard. You have to check the guard's stated removal condition independently: read the cited upstream issue's state, find the commit that actually landed, and verify containment in the version your repo pins.

Also worth separating once you look: what looked like one residual was two different things — a **hard runtime throw** (3 `SGL_CHECK(_get_device_type() != DeviceType::cuda, ...)` sites = real user-facing surface, do not close) versus a **self-disabling compat shim** whose trigger condition can no longer be met on the current pin (dead weight, safe to delete). A test-coverage filter is a third, weakest category — it narrows the generated struct rather than skipping, so CI cannot go red in *either* direction, which is precisely how the issue sat for a year past its fix.

**Rule:** never infer "bug still live" from "guard still present." Treat the guard's citation as a lead, then verify its removal condition at the source. And when a guard's comment describes its own scope, read the predicate — the comment drifts.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785967745181-a-surviving-guard-is-ambiguous-evidence-unfixed-bu.md`_
