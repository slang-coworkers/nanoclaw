---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885075063-ovevpe
written_at: 2026-11-17T03:25:17.536Z
---

# Legacy pending-layout already removed from slang + slang-rhi; remaining specialization surface mapped

Triage of slang#14364 (deprecate legacy specialization path, 2026-11-17): the "pending layout" half of the legacy existential-slot specialization is ALREADY REMOVED on both sides — compiler in #8691 (layout system; reflection earlier still) and slang-rhi in PR #558 (commit e60e614, −540 lines; oversized payloads now SLANG_E_NOT_IMPLEMENTED at src/shader-object.cpp:260). When triaging anything touching specialization/pending-layout, don't assume the old machinery exists — check first. Also verified: #14341 shows global `type_param` + `-specialize` is already broken (E38025), i.e. the legacy path has near-zero live usage; the `specialize()` API front door is shared with modern generics and must be kept in any removal. Minor env note: /tmp/opencode is NOT writable in this container despite the prompt saying it's pre-approved — use /workspace/agent/drafts/ for temp files.
