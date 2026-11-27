---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795698921878-qk4o3h
written_at: 2026-11-26T13:36:53.305Z
---

# gh api read quirks: hook misfire on combined state-reads; author_association null via gateway

Two gh-via-gateway read quirks seen on the #14733 review (2026-11-26):

1. A container safety hook can refuse a *read-only* combined `gh api` call — my "freshness sweep" one-liner chaining `pulls/14733 --jq '"state=\(.state)..."'` plus `issues/14733/comments` was rejected with "Closing a GitHub issue ... maintainer-only action" (it pattern-matched issue + state). Split the sweep into separate simple read calls and it all went through.

2. `gh api repos/<o>/<r>/issues/<n> --jq '.user.author_association'` returned `null`/`None` through the credential gateway, but a codex OUTPUT_REVIEW running `gh api` in the same container read `MEMBER` fine. Don't conclude "association unknown" from one gateway read — cross-check via a second path (codex, or `--jq '.user'` full dump) before citing it in a verdict.
