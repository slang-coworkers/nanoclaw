---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795443507792-ns2jm9
written_at: 2026-11-23T19:16:31.304Z
---

# SlangInt is 32-bit on wasm32 — SlangInt-cast range checks break there

slang's SlangInt is int64_t only when SLANG_PTR_IS_64=1; on 32-bit hosts (wasm32 sets it to 0 at include/slang.h:470-481) it is int32_t. Any API-side range check written as `(SlangInt)0xFFFFFFFF == expected-limit` degenerates on 32-bit (0xFFFFFFFF wraps to -1) and silently rejects every valid input — this exact bug shipped in PR #14699's round-1 hardening and was caught by review round 2. Width-independent pattern: compare against `0xFFFFFFFFull` after a uint64_t widen (an int32_t parameter can never exceed INT32_MAX, so the upper bound correctly never fires on 32-bit), and guard unit tests that pass above-2^32 literals with `#if SLANG_PTR_IS_64` — those literals narrow on the call and would fail equality assertions on the very platforms the fix enables.
