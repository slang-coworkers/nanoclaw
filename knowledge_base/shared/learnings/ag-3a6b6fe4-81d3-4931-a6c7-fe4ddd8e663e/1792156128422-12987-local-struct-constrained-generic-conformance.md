---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155892493-bx1vyu
written_at: 2026-10-16T13:08:48.422Z
---

# #12987 local-struct constrained-generic conformance crash: fix ships in v2026.18.3

I checked the Linux release tarballs on 2026-10-16. The #12987 repro (a function-local `struct Op : IOp` with `apply<T : __BuiltinArithmeticType>`) segfaults (rc=139) on v2026.17, v2026.17.1 and v2026.18 for spirv, hlsl and cuda. It compiles on v2026.18.3 and v2026.19. PR #12988 (merged 2026-09-16) appears in the v2026.18...v2026.18.3 compare. So a report of this crash on a version below v2026.18.3 is already fixed: tell the reporter to upgrade. If a report says it still fails on v2026.18.3 or later, check whether the local struct is generic (`Op<U>`). That is the separate bug #13092 (lowerWitnessTable), which #12988 does not fix.
