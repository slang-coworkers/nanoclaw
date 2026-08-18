---
title: "Never infer a DISPATCH property from a DEFECT property"
type: learning
topic: misc
source: learnings/1785838936616-never-infer-a-dispatch-property-from-a-defect-prop.md
---

# Never infer a DISPATCH property from a DEFECT property

## The trap

Two of us independently concluded: *"the fault is scoped to one CI runner ⇒ rerunning is counterproductive, it could just reland on the same bad box."* It was relayed to a human operator twice before the author's own rerun proved it wrong.

The attribution was **correct**. The error was structural:

> **"The fault is host-scoped" does not imply "a rerun lands on the same host."** That implication requires a *pinning* mechanism — and `runs-on: [Windows, self-hosted, regression-test]` is **label-based** dispatch, which is the exact opposite of pinning.

**Scope-of-fault and scope-of-routing are independent facts requiring independent evidence.** The `runs-on:` line is the instrument for the second one, and neither of us read it. A rerun over a pool of N boxes with K healthy is a ~K/N lottery — a legitimate cheap stopgap, not a dead end.

Proof, on one unchanged head (`ba156ebf`, run `30885595493`) where the runner is the only variable:

| attempt | runner | result |
|---|---|---|
| 1 | SLANGWIN5 | ❌ |
| 2 | SLANGWIN5 | ❌ |
| **3** | **SLANGWIN4** | ✅ |

## Rules

1. **When a remedy's justification contains "it would just happen again," name the mechanism that would make it happen again — then go read it.** For CI: read `runs-on:` before declaring any rerun futile. A named host pins; a label set does not.
2. **Prove a machine is still in the pool with a *passing job*, never with a missing row.** A collaborator checked for the bad runner in recent runs, found no rows, and nearly concluded it had been drained — but *zero jobs of that type* ran in the window, so the absence measured **dispatch**, not drainage. The load-bearing datum was positive: the box took and *passed* a different job. (Yet another zero with no non-zero control.)
3. **A defect can be job-scoped on a perfectly healthy host** — same box, same window: three other job types all passing. That kills "reboot/recycle the runner" as the remedy. Look for a same-host sibling-job success before naming a fix.

## Meta: this is a recurring *family*, not a one-off

Same shape as debating a gate's placement/syntax/precedent for three rounds above an unverified premise (the binary being gated didn't exist). **Both are a remedy argued at length above an unexamined premise about the thing the remedy acts on** — there the artifact, here the dispatch rule. Verification effort flows to whatever is most recently *disputed*; premises nobody is arguing about never get checked, which is precisely why they're invisible.

## Propagating a retraction: position decides what gets read

A correction must land in the **most-read position**, not merely be appended. For a stored note that meant: the **frontmatter `description`** (which still asserted the wrong claim — where a reader lands first), a body banner with the disproof, *and* the index row. Appending alone leaves the stale claim exactly where it does the most damage. If the wrong claim was already relayed onward, say so explicitly to whoever received it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785838936616-never-infer-a-dispatch-property-from-a-defect-prop.md`_
