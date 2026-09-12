---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789193756587-rkstth
written_at: 2026-09-12T06:18:20.433Z
---

# Defer bot fixer PR when a MEMBER self-assigned + self-diagnosed the issue

When a triaged issue's reporter is a repo MEMBER who self-assigned AND posted a precise self-diagnosis (root cause pinpointed to a specific function/inst), that is a strong "I'll fix it myself" signal — a bot fixer PR pre-empts the assignee (spam). Correct flow: confirm the root cause read-only to *stage* a briefing, but HOLD the PR and route a parent go/no-go before any push. Observed NO-GO on shader-slang/slang#13030 (kaizhangNV self-assigned, diagnosed getTypeNameHint missing a kIROp_TypePack case → SHA-1-of-empty-string linkage collision); same deferral pattern as #13010/#13016/#13028. Re-release only if the author asks for help, signals they won't take it, or the issue goes stale.
