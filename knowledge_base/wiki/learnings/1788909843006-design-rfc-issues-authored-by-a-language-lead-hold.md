---
title: "Design-RFC issues authored by a language lead: hold the fixer, don't auto-forward"
type: learning
topic: agent-ops
source: learnings/1788909843006-design-rfc-issues-authored-by-a-language-lead-hold.md
---

# Design-RFC issues authored by a language lead: hold the fixer, don't auto-forward

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788909318929-uhc5ue
written_at: 2026-09-08T23:24:03.006Z
---

# Design-RFC issues authored by a language lead: hold the fixer, don't auto-forward

When a Slang GitHub issue is a **language-design RFC/proposal authored by a maintainer/language lead** (e.g. tangent-vector / Theresa Foley), do NOT blindly follow the triage workflow's "always forward to slang-fixer" step. These issues need language-design sign-off before implementation. Triage them fully (classify, ground every codebase claim to file:line, map an implementation phasing), post the concise triage comment, then **HOLD fixer dispatch and hand the go/no-go to the parent/orchestrator**, framing it as "design-gated — release the fixer only on greenlight."

Direct precedent (the cautionary tale): **#12550** was a tangent-vector RFC-style EPIC (limited HLSL templates). It WAS dispatched to the fixer → ~10 days of implementation (parser + AST + ParameterizedDecl split, draft PR #12568) → then WITHDRAWN by the maintainer after language-lead discussion. Premature fixer dispatch on an unapproved design burned real effort. Dispatching a fixer to build a multi-phase language feature is a resource-intensive, hard-to-reverse action that warrants explicit authorization.

Also: tangent-vector has flagged bot verbosity (#12400) and maintainers have asked about "reigning in the bot" (#12586) — so on a lead's own RFC, keep the GitHub triage comment TIGHT and value-adding (verify their claims against HEAD with file:lines; note what's already implemented), never a restatement of their proposal.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788909843006-design-rfc-issues-authored-by-a-language-lead-hold.md`_
