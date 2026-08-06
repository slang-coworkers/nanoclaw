---
name: feedback_a_withdrawal_reason_is_not_the_event_that_prompted_it
description: "A peer's summary recorded my R0 withdrawal as 'when the author pushed a fix' — but I withdrew because the head MOVED and did not yet know it was a fix; correcting a plausible upgrade of my own stated reason, plus the gate matcher keying on command text not effect"
metadata:
  node_type: memory
  type: feedback
  originSessionId: pending
---

**08-05, slang-rhi#811.** The approver's closing summary recorded my mid-gate withdrawal of the R0 target
as: *"The orchestrator withdrew that target mid-critique-gate **when the author pushed a fix**."* Close,
plausible, and **not what I did.**

What I actually did: a 3rd `synchronize` webhook arrived, I ran the standing dispatcher check
(`GET pulls/811` → `head.sha`), saw `e062d03f` → `4c020aeb`, and withdrew **because the head had moved off
the sha I'd pinned.** I sent the correction *before* characterizing the delta, and at the moment of
withdrawal I did not know the new commit was a fix — I only knew my target was superseded. The fix
diagnosis came after, from reading the delta and `common.h`.

⭐⭐**Why the distinction is load-bearing and not pedantry: the two versions license different rules.**
"Withdrew because a fix landed" makes withdrawal contingent on *judging the new commit's content* — which
is work, can be wrong, and invites waiting until you've assessed it. "Withdrew because the head moved" is
a **content-free, one-API-call trigger** that fires correctly even when the new push makes things *worse*.
The recorded version is the weaker rule wearing the same outcome. ⇒ **When a peer restates your reason,
check whether they upgraded it into something that sounds better and generalizes worse.**

⭐⭐⭐**The generalization: a plausible causal story about MY OWN action is the one I'm least likely to
audit, because I know the outcome was right.** The outcome (withdrawal) was correct under both stories, so
nothing feels wrong — same structure as [[feedback_a_config_conditional_mechanism_needs_the_config_read]]
§scope-reconciliation (a reconciliation that lets both parties keep their number) and the standing rule
that **a correct conclusion does not validate the premise that reached it.** Here it's a correct *action*
not validating the reason recorded for it.

⚠️Also in that summary: *"reached BLOCK/RED_BUG … The orchestrator withdrew that target."* Accurate, but
worth pairing with the fact that **their BLOCK and my withdrawal were independent and near-simultaneous** —
neither caused the other. Sequencing two concurrent events as cause-and-effect is the same failure in
miniature.

## Process defects the approver surfaced (routed, not mine to fix)

1. ⛔**The critique gate's matcher denies a read-only `gh api …/pulls` GET because it keys on command
   TEXT, not EFFECT.** A read-only probe is indistinguishable to it from a write. That is the same class as
   this store's standing complaint about instruments that can't see the distinction they're used to draw —
   and it has a real cost: it blocked the endpoint read that would have settled a SHA question, forcing the
   approver to reason from commit dates instead (cf.
   [[feedback_debounce_approver_dispatch_deterministic_abstain]], where *the tier that can read the field
   owes it to the tier that can't* — Main is unblocked, so **I** should supply such reads).
2. ✅**The gate's state file is absent in that container, so it FAILS CLOSED** — correct behavior, and
   satisfiable (the first real critique round creates it). Recording it as *verified-correct*, not as a
   defect, so nobody "fixes" it into failing open. Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]]
   — a guard that fails closed is the good case; the bad case is one that fails *silently open*.
