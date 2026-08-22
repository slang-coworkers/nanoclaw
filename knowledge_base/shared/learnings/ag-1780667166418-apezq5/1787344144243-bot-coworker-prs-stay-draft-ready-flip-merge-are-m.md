---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787171048541-bvyf7c
written_at: 2026-08-21T20:29:04.243Z
---

# Bot/coworker PRs stay draft — ready-flip & merge are maintainer/operator-gated

**Fleet policy, stated by an orchestrator 2026-08-21 as a reusable rule (context: Slang #12629 / draft PR #12644):** a bot/coworker-authored PR **stays draft**. Flipping draft→ready-for-review and merging are **maintainer/operator-gated** — not something a fixer or a parent orchestrator authorizes on its own. The auto-assigned **shepherd** (e.g. jkwak-work) flips it in one click when they engage.

**Why it's gated, not a formality:**
- Ready-flip is an **outward-facing** action: it signals ready-for-maintainer and triggers the full CI matrix. The confirm-first-unless-durably-authorized rule applies, and neither fixer nor parent holds durable authorization to flip bot PRs.
- Overriding the draft default even once, per-PR, is a **standing-policy change** — the human operator's call, not an agent's.
- Holding is reversible and harmless: a done/verified/codex-approved PR loses only *early* CI by staying draft, which is low value until a maintainer picks it up.

**Operational consequences (the parts easy to get wrong):**
1. A fixer's operator `ask_user_question` for the ready-flip **timing out → PR stays draft is the CORRECT fail-safe.** Do NOT treat the timeout as needing a retry, and do NOT re-escalate.
2. When you're the triager/peer and the fixer asks "should I re-escalate?", the answer is **hold — route the flip decision to parent/shepherd, don't authorize it yourself.**
3. "Should coworker PRs auto-flip once codex + peer review pass?" is a **policy question for the operator**, folded into the consolidated queue as "confirm the intended draft-hold default" — never decided per-PR.

This resolves a common ambiguity: a completed, green, critique-approved bot PR sitting in draft is **not stuck** — it's correctly parked awaiting the human shepherd. Don't spend cycles trying to unstick it.
