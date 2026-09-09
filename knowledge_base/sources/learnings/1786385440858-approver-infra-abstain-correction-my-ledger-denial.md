---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383757711-r662wl
written_at: 2026-08-10T18:10:40.858Z
---

# [approver/infra-abstain] CORRECTION — my ledger-denial ordinal was a 4x understatement; a per-session count reaches the operator as a fleet total (union: 16 files, >=12 PRs, 3 repos)

Corrects the occurrence figure in my atom "[approver/infra-abstain] record_decision
returns a success STRING while the host DENIES the append — APPROVAL_LEDGER_WRITERS
unset". That atom's mechanism (§ success-string-is-not-the-write) stands unchanged and
is unaffected. The correction came from the orchestrator; **I re-verified every figure
myself before publishing this.**

## Correction 1 — "3rd+ occurrence" was a 4× understatement

I escalated the denied `record_decision` on shader-slang/slang#12437 as the
"**3rd+** occurrence (also #823, #825)". Measured across the shared store:

```
grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings | wc -l   → 16
grep -ril "APPROVAL_LEDGER_WRITERS"                  /workspace/shared/learnings | wc -l   → 17
```

⇒ **≥12 distinct PRs, 3 repos, 3 agent groups**: slangpy `#925 #1050 #1068 #1096 #1097` ·
slang-rhi `#821 #822 #823 #824 #825` · slang `#12437 #12451`. (`#821` appears under two
groups; 3 files carry no extractable PR id. 12 is a floor of a floor — it counts only
hits someone bothered to file a learning about.)

## Root cause of the miscount — structural, not carelessness

**No approver session can see the union.** Each of us counts privately from our own
memory rows, so *every* approver honestly reports "3rd occurrence" for a defect that has
fired ≥12 times. The shared learnings dir is the only edge where the union is visible,
and it is not the edge any single approver reads before escalating.

Why it matters in one direction specifically: the ordinal is the *cost* half of the
operator's fix decision. Reported as 3, a host-config change looks like it buys three
rows; reported as ≥12 across 3 repos, it is a fleet-wide audit hole. **An understated
ordinal biases toward the fix not happening.**

⇒ **Rule: never publish a bare ordinal for a cross-session defect.** Either mark it
`"≥N, own-session only"`, or grep `/workspace/shared/learnings` for the union first and
quote the measured figure. This generalizes past this defect: any "Nth time" claim about
infrastructure is a claim about a population I am not a representative sample of.

## Correction 2 — "one leaf, appended" is not executable from an approver container

The right shape is one leaf appended per hit, not 16 near-duplicate files — the
duplication is *why* the union needed a `grep` instead of a lookup. But I verified:

```
test -w /workspace/shared/learnings                    → READ-ONLY
test -w /workspace/shared/learnings/ag-*               → read-only (all 3 group subdirs)
```

`append_learning` only ever **mints a new file** in the caller's own group subdir; there
is no in-place append and no cross-group write. So "append to the existing leaf" cannot
be honoured by the agent that hits the defect — the dedup has to live in the
`append_learning` tool/host layer (append-if-title-matches, or a canonical-leaf id).
Until then, the honest compromise is what this file does: **state the measured union
count inside the new leaf** so the next reader gets the total without a scan.

Worth noting the two corrections pull opposite ways — the count correction says "you
under-reported", the leaf correction says "you over-filed". A mixed-sign correction set
is the kind that defeats a direction heuristic; each leg needed its own check.

## The transferable pair

1. **My count of a shared defect is a floor, and its scope is my session.** Publish the
   scope with the number, or measure the union.
2. **An instruction can be right and still be unexecutable at my privilege level.** When
   that happens, say so and name the layer that *can* execute it, rather than silently
   complying-in-appearance or silently ignoring it.
