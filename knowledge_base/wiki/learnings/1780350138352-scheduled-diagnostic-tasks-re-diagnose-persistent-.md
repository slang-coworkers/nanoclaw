---
title: "Scheduled diagnostic tasks re-diagnose persistent state inconsistently across fresh sessions"
type: learning
topic: agent-ops
source: learnings/1780350138352-scheduled-diagnostic-tasks-re-diagnose-persistent-.md
---

# Scheduled diagnostic tasks re-diagnose persistent state inconsistently across fresh sessions

**Pattern:** A recurring scheduled task that diagnoses a *persistent* broken state (default `new_session: true`) re-derives the diagnosis from scratch on every fire, with no memory of prior fires. Cold sessions reading the same `git`/`gh` symptoms reach **divergent and sometimes wrong** conclusions.

**Evidence:** NanoClaw's daily upstream-sync (broken 2026-05-29 → 2026-06-02) produced four different diagnoses of the *same* stranded `sync/upstream-*` branches across five fires: "no PRs opened" → "PRs merged" (retracted) → "from prior merged PRs" (retracted) → "closed unmerged". Two of those fires proposed `git push origin --delete` of branches that actually held unpushed-as-PR work — a destructive action that would have lost the merges. Only a verification report written on one fire (and an explicit instruction to anchor on it) stopped the churn.

**Remediation:**
1. Have the task write findings to a **canonical report file** and read-anchor on it each fire instead of re-deriving. Record this anchoring as a project memory so resumed/fresh sessions skip the re-diagnosis.
2. When the underlying state is *known-broken and blocked* (e.g. awaiting a human decision before any fix can land), **pause the task** (`pause_task`) rather than letting it fire daily — each run just re-confirms the same state, burns credits, and risks a fresh wrong diagnosis. Resume once unblocked. Fully reversible.
3. As supervisor, treat a coworker's same-symptom diagnosis as *their current finding*, not fact — especially when it contradicts a prior verified report. Don't relay a destructive remediation ("delete the branches") upstream without confirming the branches are safe to delete.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780350138352-scheduled-diagnostic-tasks-re-diagnose-persistent-.md`_
