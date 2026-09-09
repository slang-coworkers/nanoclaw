---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786488743141-3j6fgf
written_at: 2026-08-12T13:12:38.343Z
---

# [approver/clause-gap] large generated-docs sweeps chronically trip tier_eligible; the size cap is churn, not risk

## Symptom
shader-slang/slang#12477 ("work the doc-gap queue — 417 decisions across 43 design docs") pushed 3 revisions in ~1 day, each 12,000–14,000 changed lines across ~100 files, ALL under `docs/generated/**` + one `.github/workflows/` file. Every revision tripped `tier_eligible` (cap 8000 lines, policy v0-shadow-wide) → ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible, Step-1 short-circuit each time (challenger/Devin/critique never ran). The PR then **merged** (author self-merge, MEMBER) — so all three abstains scored as agreement-equivalent (merged ⇒ approved; "a human must look" confirmed by "a human looked and merged").

## Root cause
The `tier_eligible` line cap is a **churn** proxy, not a **risk** proxy. A generated-docs regeneration/gap-intake sweep is inherently huge (hundreds of doc-gap decisions, +207 watched_paths, ledger JSON) yet carries near-zero merge risk: no compiler code, the production claude-code-action review was clean/near-clean, and the only machinery findings (regenerate.py finding-id regex; Devin's 3 🔴 all in regenerate.py) were explicitly scoped to a sibling PR (#12476) and fixed by the author's own interval commits. The cap can't distinguish 12k lines of generated markdown from 12k lines of hand-written compiler source.

## How to catch it / what it means for the decision
- A `docs/generated/**`-only diff over the size cap is the *expected* shape for a regeneration PR, not a smell. The abstain is still correct procedure (shadow mode never auto-approves; size-cap = deliberate "human must look"), but it carries **zero code-risk signal** — don't read the abstain as "this PR is concerning."
- On a churn-driven abstain that will recur on every `synchronize` (huge sweep that won't drop under the cap without splitting), tell the orchestrator once that it re-abstains identically; they can downgrade later revisions to a one-line confirmation and ask to be flagged only if a *different* clause fails or the diff drops under the cap. That protocol worked here (R3 was a one-liner).
- The bot review goes STALE fast on a rapidly-pushed PR (harvest exit 10): #12477 R2/R3 both had the bot still parked on an intermediate commit. Fall to Devin-only per workflow — but since Step-1 short-circuits on the size cap anyway, the stale review never mattered to the outcome.

## Fix (policy direction, for enforcement)
The mounted policy's own comment already says the cap must be set empirically from measured precision-vs-PR-size before enforcement. A path-aware cap — higher (or waived) for `docs/generated/**`-only diffs, strict for compiler source — would recover measurement signal on exactly this class (generated-doc sweeps) without loosening the gate where churn correlates with risk. Until then, expect this class to abstain-on-churn and score as agreement on merge.
