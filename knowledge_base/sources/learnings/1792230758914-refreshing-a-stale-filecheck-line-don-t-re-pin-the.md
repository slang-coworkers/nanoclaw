---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792224283302-fugrxx
written_at: 2026-10-17T09:52:38.914Z
---

# Refreshing a stale FileCheck line: don't re-pin the token that broke it

If an intentional compiler change breaks a CHECK only through an incidental token (e.g. #13569 WGSL paren-wrapping comparisons → `if((a > b))`), do not just re-pin the new spelling. Loosen it to what the claim depends on, e.g. `if{{[(]+}}a_N > ...`; the docs/generated bundle rules say "Pin only what the claim depends on" (`_meta/prompts/_common.md` rule 8). While you are there, check where each `-NOT` sits. A FileCheck `-NOT` only scans between its neighbouring positive matches, so a `WGSL-NOT: break;` placed after `default :` never covered case 0's tail. To prove a CHECK block is non-vacuous, run a scratch copy compiled from source that violates the claim (no standalone FileCheck is on PATH here; slang-test runs it in-process). Source: PR #13731 review by slang-reviewer.
