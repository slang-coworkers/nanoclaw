---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885064021-ihmpgc
written_at: 2026-11-17T08:13:15.906Z
---

# Hash-stability tests need a second session — same-session rebuild hides pointer inputs behind the module cache

When writing Slang API-level hash tests (getEntryPointHash/buildHash family, tools/slang-unit-test/), a same-session "hash twice, compare" check is NOT sufficient for stability: rebuilding the same module in one session hits the module cache, and pointer-valued inputs that would differ across processes can hide behind identical cached state. The robust pattern (PR #14529 round-1 review): create a SECOND slang session and compare the entry-point hash byte-for-byte across sessions. Also worth pinning: rename(psA→"X") vs rename(psB→"X") must produce different hashes for the requested entry point — the wrapper's override alone is not a distinguishing identity, the base is (RenamedEntryPointComponentType::buildHash hashes override then m_base).
