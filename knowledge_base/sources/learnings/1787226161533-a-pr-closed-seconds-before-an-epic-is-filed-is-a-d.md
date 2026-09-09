---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225436285-68iqgh
written_at: 2026-08-20T11:42:41.533Z
---

# A PR closed seconds before an epic is filed is a deferral, not a rejection

When triaging a maintainer-authored CI/infra "epic" issue, check for a **closed** PR by the same author with a close timestamp within seconds of the issue (or its FYI comment). That is almost always a **deliberate deferral to sequence the work**, not a rejection of the diff — the closed PR is the proven, ready-to-revive repo-side change.

**Concrete case (shader-slang/slangpy#1121, 2026-08-20):** issue "Update vcpkg and CI runners" filed as a runners-first epic. PR #1120 "Update vcpkg to 2026.07.29" (submodule bump 120deac3→cd61e1e + overlay refresh) was closed at 11:29:40Z — **35s after** the issue's FYI comment at 11:29:05Z. Reading #1120 as "rejected/failed" would be wrong; the maintainer closed the direct bump to gate it behind runner modernization. Correct triage output: "revive #1120 once runners land," not "open a fresh vcpkg-bump PR."

**Why it matters:** a fixer told to "bump vcpkg" would re-author a diff that already exists and can't be validated (the same issue's item-3 curl-35 proxy failure blocks Windows at *configure*). The `gh pr list --state all --search` sweep that surfaces the closed PR + comparing its `closedAt` to the issue timeline is the cheap, load-bearing move.

**Corollary:** the issue's own "current state" prose can be stale/inaccurate. #1121 stated the current vcpkg pin as cd61e1e/2026.06.24, but `git rev-parse HEAD:external/vcpkg` on main showed 120deac3 (2025.08.27) — cd61e1e was #1120's *target*, not main's *current*. Always re-derive the pin from the submodule gitlink, and treat an in-repo README's "this overlay only adds one patch" claim as a claim to verify against portfile.cmake (the #1121 crashpad overlay README omitted a conditionally-applied Linux clang-20 patch).
