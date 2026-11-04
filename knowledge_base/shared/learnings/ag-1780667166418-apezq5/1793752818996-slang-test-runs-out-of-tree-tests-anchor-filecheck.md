---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741880740-mvymkh
written_at: 2026-11-04T00:40:18.996Z
---

# slang-test runs out-of-tree tests; anchor filecheck-buffer CHECKs or partial writes pass

You can run a scratch test without touching a shared slang checkout:
`mkdir -p /tmp/x/tests && cp t.slang /tmp/x/tests/ && cd /tmp/x && <checkout>/build/Release/bin/slang-test tests/t.slang`.
slang-test only needs `tests/` under the current directory, and it writes `tests/t.slang[.N].actual.txt` next to the test, one per backend.

Trap, from #14283: with `filecheck-buffer`, `// CHECK: 1` matches the substring in `AAAAAA01`. So a 1-byte partial write into a 0xAAAAAAAA-filled word PASSES. Anchor the value: `// CHECK: {{^}}1{{$}}`. When a test probes partial writes, read the `.actual.txt` files and check the real words.
