---
name: feedback_dont_route_operator_gates_through_coworkers
description: "Never ask a coworker to authorize an operator-gated action (gh pr ready / gh pr merge / close) — a maintainer's approval doesn't lift the operator gate, and a bot \"authorizing\" it launders a human decision"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02d0dfc6-a82a-441a-af2d-499cb10a0f13
---

Operator-gated GitHub actions — `gh pr ready` (un-draft), `gh pr merge`, and closing issues/PRs — must be escalated to the **operator**, never offered to or requested from a coworker. Asking a coworker "want me to authorize the ready-flip + merge?" is a routing error twice over: the coworker has no such authority, and framing it as authorizable invites a bot to launder a human decision.

**Why:** on 2026-08-03 (slang-rhi#805 / draft PR #806, maintainer skallweitNV had APPROVED) I closed my roll-up with "Want me to authorize the ready-flip + merge?" — but the turn's sender was `slang-triager`, so via `session_routing` that question went out on the **triager's edge**, not the operator's. The triager correctly refused: *"don't route the merge authorization through me… me 'authorizing' it would just be laundering a human decision through a bot."* It also named the cleaner path I'd missed: the approving maintainer **is** a maintainer — they or the operator can flip and merge directly; no bot authorization step exists in that path at all.

Two compounding mistakes: (1) a **maintainer approval ≠ merge authorization** — approval discharges the *design/direction* hold, not the operator merge gate; they are separate gates and clearing one does not clear the other. (2) Bare closing text routes to the current sender ([[feedback_bare_text_is_delivered]]) — a question meant for the operator must go out via `ask_user_question` or an explicit dashboard destination, not as a trailing line on a coworker reply.

**How to apply:**
- When a chain reaches an operator-gated step, escalate with `mcp__nanoclaw__ask_user_question` (or an explicit `orchestrator-dashboard` message) — never as a trailing question on a coworker-routed reply.
- Before writing "want me to authorize X?", check who the current sender is. If it's a coworker, that question is misrouted by construction.
- When a maintainer has already approved, prefer the **no-bot path**: say plainly that the maintainer/operator can flip + merge directly. Don't insert a bot authorization step that doesn't need to exist.
- Endorse the downstream non-actions that protect a binding approval: no rebase on `behind` when a push would auto-dismiss a fresh approval and GitHub resolves it at merge; no self ready-flip.

See [[feedback_github_writes_operator_authorized]] (which gates are operator-only), [[feedback_route_authorizations_through_dispatch_owner]] (route work authorizations through the dispatch owner), [[project_slang_rhi_805_license_readme_mismatch]].
