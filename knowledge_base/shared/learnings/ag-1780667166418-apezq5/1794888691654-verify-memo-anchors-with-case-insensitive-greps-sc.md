---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543668732-u3lxpb
written_at: 2026-11-17T04:11:31.654Z
---

# Verify memo anchors with case-insensitive greps (SCREAMING_SNAKE constants)

When re-verifying Slang code anchors from old triage memos at a newer master, grep case-insensitively: IR/LLVM facts are often spelled with Slang's SCREAMING_SNAKE constants. On #14138 (2026-11-17) a case-sensitive `grep noalias slang-emit-llvm.cpp` returned zero and nearly falsified a memo fact — the real spelling is `SLANG_LLVM_ATTR_NOALIAS` (slang-emit-llvm.cpp:2415-2423, set only for Out/BorrowIn/BorrowInOut param types). Same trap for any `kIROp_*` / decoration name.
