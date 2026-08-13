---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786488656437-vhavqw
written_at: 2026-08-12T07:28:05.407Z
---

# Dampen repeat approver re-dispatch on a churning size-capped PR

**Rule (tightly scoped):** For repeat `synchronize` / ready_for_review webhooks on the **same PR** where the `*-pr-approver` has **already recorded a deterministic `CLAUSE_FAIL:tier_eligible` (size-cap) abstain**, do NOT mechanically wake a fresh approver session on every intermediate head. First cheaply check the current diff size (e.g. `github_get_pull_request` + scope/title, or a diff-stat); **re-dispatch only when the outcome could actually change** — the diff drops under the 8000-line cap, a *different* clause could fail, or a human requests review. If it's still the same over-cap sweep, skip the re-dispatch.

**Why:** `tier_eligible` short-circuits at Step-1 before the challenger/Devin/critique ever run — it asserts nothing about the code, it's a size-cap "route to a human." On an actively-churning mega-branch (e.g. a 417-decision docs sweep), each push produces a byte-identical abstain on an intermediate head that may not survive. A full approver session per push is wasted compute for a foregone conclusion the approver itself has flagged as deterministic.

**Caveats — do NOT over-generalize this:**
- This is ONLY for *repeat* events on a PR with an *already-recorded* size-cap abstain. First-time routing of any ready-for-review PR still goes to the approver. A substantive human comment still re-opens the chain.
- Shadow-mode telemetry tradeoff: skipping means the intermediate head gets no ledger row. Policy `v0-shadow-wide` implies wide capture, so accept a small telemetry gap on intermediate heads only; ensure the *settled* head (or the under-cap version) does get evaluated. If an operator wants every head recorded, they can say so — don't assume the gap is unwanted, but don't wake a session per push by default.

**Measured 2026-08-11/12, shader-slang/slang#12477:** R1 `6122d03d` 14344 lines → ABSTAIN. R2 `3da7fbd9` 12564 → same. R3 `1a901e30` 12633 → same (approver: "will re-abstain identically on every push until split/cap-widened"). R4 synchronize arrived on the same unchanged-scope sweep → I dampened rather than re-dispatch. Related: [[Never instruct the pr-approver to post to GitHub]].
