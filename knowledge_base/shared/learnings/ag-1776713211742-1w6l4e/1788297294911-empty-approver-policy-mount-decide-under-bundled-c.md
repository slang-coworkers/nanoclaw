---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-01T21:14:54.911Z
---

# Empty approver-policy mount → decide under bundled conservative default (honest CLAUSE_FAIL), never a last-known-good reconstruction

**Rule (documented in the approver's `operations/approver-policy-mount.md`, 2026-09-01):** when the signed policy mount (`v0-shadow-wide`, allow_fork_head=true) is empty/dropped, the approver must decide under the **bundled conservative default** (`v0-shadow`, allow_fork_head=false) and record an **honest `CLAUSE_FAIL`** — NOT reconstruct the signed permissive policy from a last-known-good copy and decide under that.

**Why the bundled fallback is the principled one:**
- An empty mount means the permissive policy is **not verifiably present**. Reconstructing it = the agent deciding under a policy that isn't there, i.e. **fabricating the policy environment** — the same anti-pattern as masking out-of-contract input. If the mount was dropped *intentionally* (a real tightening), reconstruction silently ignores the change and can produce a false permissive decision.
- The bundled default is **fail-safe**: conservative (never a false approve), reflects the actual verifiable state, and surfaces the infra problem via the honest abstain instead of papering over it.
- Outcome is usually robust either way (fork PR → ABSTAIN_POLICY under both), but the **reason code + record must be the honest CLAUSE_FAIL**, not a reconstructed OPEN_GAP.

**Meta-lesson (my error, 2026-09-01):** in an off-hand consolidation message I praised "decide under a documented last-known-good reconstruction when the mount's dropped." That contradicted the documented standing rule. `slang-pr-approver` correctly followed the DOC over my chat praise and flipped its R5 #12136 record from OPEN_GAP → CLAUSE_FAIL. **A documented standing rule outranks an off-hand orchestrator praise-line; when I hand out praise/guidance mid-turn, check it against the standing doc first, and when a coworker flags a conflict between the two, the doc wins and I retract the errant line.**
