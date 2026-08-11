---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-11T01:42:06.626Z
---

# [approver/challenger-miss] A review flag pointing AT the fix under review is the one you can least afford to clear cheaply — "the only trigger is X" is a universal claim

## Symptom

slang-rhi#826 R2 fixed a regression my own R1 BLOCK had named. The reviewer's fresh signal
was `0 Bugs / 2 Flags`, and Flag 2 pointed **at the fix itself**: *"Backend lifetime now
owns a live VkInstance and loaded ICD."*

I cleared it: *"its only plausible trigger is process exit, where the destructor runs."*

An independent reviewer found the path I had not looked for. `destroyRHI()` is **documented
public API** whose header states recreation is supported — *"After calling this, getRHI()
will create a new instance on next call"*. Its implementation deletes the singleton, which
nulls every backend, which runs `~BackendImpl()` → `vkDestroyInstance` + `dlclose`. A later
`getRHI()` reloads. So **across RHI generations the retained pin is released and
re-acquired — precisely the unload/reload sequence the PR existed to prevent.** The fix
narrowed the window to one RHI lifetime; it did not remove the failure mode. And nothing
exercises it: `grep -rn destroyRHI tests/` finds exactly one caller, at process shutdown,
with nothing created afterwards — so CI green carried zero information about it.

Correct call: `ABSTAIN_POLICY:OPEN_GAP`, not "clears with a limitation recorded".

## Root cause

Two compounding errors.

**1. Structural: I had just spent hours proving this fix resolved my own finding.** Every
piece of evidence I'd gathered pointed the same way — the failure signature had vanished,
the author's comment named my mechanism, CI was fully green. Against that momentum,
clearing an objection to the fix felt like *continuity*, not laxity. That is precisely the
condition under which a flag aimed at the fix needs the most scrutiny, not the least: it is
the only finding in the set that can undo the conclusion I had already reached.

**2. Logical: "the only trigger is X" is a universal claim over a surface I never
enumerated.** I asserted an exhaustive property of the exit paths without listing them.
"Only" and "no other" are quantifiers; they require enumeration, not intuition. The cheap
version of the check would have been one grep for the public teardown entry point.

## How to catch it

- **Tag any finding whose target is the change under review.** If clearing it would restore
  a conclusion you already hold, write the reachability argument out in full — every public
  entry point, every destructor path, every documented lifecycle — rather than asserting a
  trigger set.
- **Treat "only / never / no other" as a checkable claim.** Before writing it, enumerate:
  `grep -rn <api> src/ tests/ examples/` and read the public header's documented contract.
  A documented lifecycle you didn't look at outranks your model of "how it's used".
- **Ask what CI can see.** A resource-lifetime change is exercised only if a test performs
  the lifecycle. If the relevant API has one caller at shutdown, green says nothing — the
  absence of coverage is itself the gap.
- **Don't let a narrowed window read as a closed one.** "Safe within one lifetime" plus "the
  same failure class returns at the next boundary" is a gap, not a mitigation.

## The transferable rule

**Credit does not carry forward.** "The author fixed my last finding, on exactly the
mechanism I named" is a fact about the previous revision and no evidence at all about the
next objection. The revision-chain discipline that stops a stale 🔴 becoming suspicion must
equally stop a resolved 🔴 becoming trust. Both substitute a remembered position for
evidence at the pinned head.

Related shape worth watching: **a documented invariant can be falsified by the PR under
review.** In the same PR, `device.h` documented *"pipelines that perform nested work on that
pool must return false"* while the change made exactly such a pipeline return `true` — the
premise being that an earlier PR made it safe. Whichever side is stale, the tree now
contradicts its own concurrency contract, and the next author reads that comment to decide
what is safe. That is a correctness-documentation defect, not a comment nit.
