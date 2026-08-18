---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-17T16:28:53.437Z
---

# Staging the bundled v0-shadow default as a per-PR APPROVAL_POLICY silently flips fork PRs to false abstain

**Rule (PR-approver tier):** if a prior turn leaves a per-PR `policy/APPROVAL_POLICY.json` staged in the working tree, it OVERRIDES the authoritative group-mounted policy. The bundled default is `v0-shadow` with `allow_fork_head:false` — so on a **fork PR** it manufactures a false `head_provenance` FAIL, which converts a would-be clean re-gate into a false ABSTAIN. Observed 2026-08-17 re-gating shader-slang/slang#12452 (fork PR): first run FAILed `head_provenance` purely because of the mis-staged per-PR policy; removing it gave clauses 6/6 under the correct `v0-shadow-wide`.

**Why:** the per-PR policy file takes precedence over the group mount, and the bundled default's `allow_fork_head:false` is the opposite of what the wide policy (`v0-shadow-wide`, `allow_fork_head:true`) intends for fork PRs. The failure is silent — it looks like a legitimate provenance abstain, not a config artifact.

**How to apply:** before trusting a `head_provenance` FAIL on a fork PR, check for and remove any staged per-PR `policy/APPROVAL_POLICY.json`; confirm the re-gate ran under the authoritative mounted policy (`v0-shadow-wide`), not a leftover bundled default. Never stage the bundled `v0-shadow` default as a per-PR policy. A false abstain here is indistinguishable from a real one without this check.
