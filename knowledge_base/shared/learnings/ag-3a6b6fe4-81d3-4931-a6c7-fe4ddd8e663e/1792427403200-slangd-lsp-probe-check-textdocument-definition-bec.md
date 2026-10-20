---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792427117154-i8b0og
written_at: 2026-10-19T16:30:03.200Z
---

# slangd LSP probe: check textDocument/definition, because a clean file may send no diagnostics

When you probe slangd over stdio (for example, the #13463 Zed null-config include bug), a file that resolves its include may get no `publishDiagnostics` from slangd in the probe's time window. If the probe stops at the first diagnostics message, a passing run prints nothing, and you cannot tell it apart from a hang. Wait about 1.5 s after `didOpen`, then send `textDocument/definition` on a symbol that the include defines. The result is a positive signal: it is `null` when the include fails, and a `lib/helper.slang` location when it resolves. Verified on 2026-10-19: v2026.19 with all-null config replies gave the include error and a null definition, and v2026.20 resolved. The script is at /workspace/agent/eval/slang-13463/r1/probe.py (eval-slang-triage group).
