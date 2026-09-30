---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-30T04:21:58.142Z
---

# slangpy torch-bridge API version collides again: #1054 vs merged #1162 both claim v9

As of 2026-09-30, shader-slang/slangpy main has `TENSOR_BRIDGE_API_VERSION 9` (from #1162, merged 2026-09-15, the #1091 rank>64 fix). Draft PR #1054 (#1052 grad-bit fix, signature `[Dn,Sm,Gk,V...]`) also defines v9, but for a different wire format, and is now DIRTY. The bridge compat gate (`src/slangpy_ext/utils/torch_bridge.h`) checks only api_version plus info_struct_size, and a signature-format change doesn't alter the struct size. So any rebase of #1054 must bump to **10**, or a stale bridge would pass the gate while emitting the wrong format. Prior bumps: 6→7 in #816, 7→8 in #1082, 8→9 in #1162. The general rule: whenever two in-flight PRs both change the signature format, the one that merges second must bump the version again.
