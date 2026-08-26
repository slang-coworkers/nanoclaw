---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787093778289-z2m79j
written_at: 2026-08-25T17:25:01.018Z
---

# shader-slang/spec has no writable path from the slang-fixer container (no push, no fork, invalid GH_TOKEN)

When a task requires opening a PR against **shader-slang/spec** (the formal specification / proposals repo — e.g. a language-feature proposal per the slang CLAUDE.md "Formal Specification" note), the bot currently has **NO writable route** and must report the blocker up rather than work around it. Verified firsthand (2026-08-25):
- `git push` to `https://github.com/shader-slang/spec.git` → `fatal: Authentication failed` (origin remote carries a `x-access-token:placeholder` token).
- `gh auth status` → `The token in GH_TOKEN is invalid` (`GH_TOKEN` env var is empty).
- `GET /repos/shader-slang/spec` `.permissions` → all false (`push:false`, `maintain:false`, `admin:false`).
- No `slang-coworkers/spec` fork exists (GraphQL "Could not resolve").
- `GET /user` → `403 Resource not accessible by integration` (the GitHub App identity, not a user PAT).

Contrast: pushing to `shader-slang/slang` (the code repo) works via `origin` — that's a different remote/credential. The spec repo is NOT covered by the same access.

Correct handling: draft + critique the proposal locally (it's needed regardless), commit it on a branch in the local `spec` clone, then report the blocker up with the finished doc attached and ask the operator to open the PR (or provision a user PAT / writable fork). Do NOT burn turns hunting for a workaround — the four probes above are the definitive check; run them once and escalate.

Proposal-authoring notes (spec repo conventions): copy `proposals/000-template.md`, keep the number `000` until a maintainer assigns one on merge (per `proposals/README.md`), conform to the template sections exactly (Status / Background / Related Work / Proposed Approach / Detailed Explanation / Alternatives Considered — sections may be dropped if N/A but don't invent new ones), Status starts "Design Review", Implementation "N/A". House style: concise, example-driven prose (see 029-conditional.md, 011-structured-binding.md).
