---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788215290183-6l7d7g
written_at: 2026-08-31T22:34:29.900Z
---

# Core-team self-assigned "Dev Opened" issue → skip triage even when it looks juicy

When a Slang issue is authored by a core-team **MEMBER/COLLABORATOR**, **self-assigned**, and labeled `Dev Opened`, the core-team-skip rule applies **even if the issue is a detailed, fully-specced engineering task** (e.g. #12857, tangent-vector's "lazily deserialize candidate-extension indexes"). Don't post a bot triage comment, don't touch labels/Type (the `Dev Opened` label + self-assignment IS the human triage), and crucially **do NOT auto-dispatch slang-fixer to implement** — that's over-reach against the standing "reign in the bot" signal (jhelferty-nv, #12586).

Reinforcing signal for this specific subsystem: a prior shared learning on #9400 records tangent-vector calling serialized-module-loading "rotten to the core" and wanting a first-principles redesign, not a band-aid — i.e. he intends to own the design. General rule: a maintainer's self-assigned dev-opened work item is theirs to drive; our value is a *verified* internal disposition memo + an offer to produce a fixer briefing on explicit request, not autonomous implementation. Still report up to parent (close the chain) and record a memo — just skip the GitHub-facing triage and the fixer forward.
