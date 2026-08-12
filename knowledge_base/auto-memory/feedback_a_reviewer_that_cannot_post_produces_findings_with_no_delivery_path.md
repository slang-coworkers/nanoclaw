---
name: feedback_a_reviewer_that_cannot_post_produces_findings_with_no_delivery_path
description: "closest-to-the-state posting assumes the state-holder CAN write. The pr-approver architecturally cannot write to GitHub, so on a MERGED PR its maintainer-facing findings have no publisher and die silently — no check reports an unpublished finding. Trigger: any terminal verdict from a write-less tier."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fbaa18c-31c2-4a6b-b7d2-d8f86d132e3a
---

# A tier that cannot post + a closed chain = findings that die with no failure signal

**Measured 2026-08-11 on `shader-slang/slang-rhi#826`.** The `*-pr-approver` coworker type is
defined to *never write to GitHub* — correct, deliberate, keeps a shadow-mode grader from
influencing the thing it grades. The chain then hit this combination:

1. the PR **merged** (`21:51:25Z`) before the verdict landed ⇒ no tier will revisit it,
2. the approver produced **two substantive maintainer-facing findings** (a lifetime-scope hole in
   the fix's pin, and two now-false documented invariants), and
3. the approver **cannot publish them**, while my own posting authority requires an explicit
   authorization marker that a merged-PR verdict does not carry.

⇒ the findings existed only in a container workspace. **Nothing anywhere reports "a finding was
produced and never published."** No red check, no queue, no retry — the same silence as a finding
that was never made.

## ⭐⭐⭐ The rule the closest-to-the-state principle omits

*"The tier closest to the state posts it"* silently assumes **the state-holder holds a write
capability.** When it doesn't, the principle designates a publisher who cannot publish, and the
default outcome is loss — not escalation. ⇒ **When a write-less tier reaches a terminal verdict,
publication is the PARENT's action, and it has to be triggered by the verdict's arrival, not by
someone noticing later.**

## The trigger, so this is checkable rather than aspirational

**On receiving any terminal report from a tier that cannot write to the outward surface, ask:
does this report contain a claim intended for a human who will never read my inbox?** If yes,
either publish it, or state in the upstream report that it is unpublished and name who must act.
Silence is the failure mode; "the chain is closed" is not an answer, because the chain closing is
exactly what removed the last publisher.

⚠️**Do not fix this by granting the grader write access** — that reintroduces the influence the
no-write rule prevents. The fix is a publication hop at the tier that already has authority.

## Why the merged state makes it worse, not moot

Instinct says a merged PR needs no review output. Wrong here in a specific way: finding (1) was
about a code path **no test exercises** (`destroyRHI` has a single caller, at shutdown), so
**CI green carries zero information about it in either direction.** A merge decided the PR; it
decided nothing about the finding. ⇒ ⭐⭐**"It merged" answers the question "does this block?",
never the question "is this true?"** — and only the first of those expires.

Related: [[project_slang_rhi_826_merged_before_verdict_stale_stage]],
[[feedback_record_decision_ok_proves_emission_not_persistence]].
