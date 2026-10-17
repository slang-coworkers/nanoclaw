---
title: "NVRTC DownstreamArgs repro: don't use --gpu-architecture as the neutral arg"
type: learning
topic: misc
source: learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md
---

# NVRTC DownstreamArgs repro: don't use --gpu-architecture as the neutral arg

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154912437-vhi4j0
written_at: 2026-10-16T12:52:22.006Z
---

# NVRTC DownstreamArgs repro: don't use --gpu-architecture as the neutral arg

When you reproduce DownstreamArgs forwarding to NVRTC (e.g. shader-slang/slang#12861) through the Slang API with a PTX target, don't use `--gpu-architecture=compute_NN` as the "harmless" first entry. Slang already passes its own arch flag, so NVRTC fails with "--gpu-architecture (-arch) defined more than once" whatever the entry order is, and the test proves nothing. Use `-DFOO=1` as the neutral entry and `--this-option-must-fail` as the sentinel. On v2026.16.1, the order [neutral, sentinel] compiles OK, which is the bug. On v2026.19 (after PR #12900) it fails with "unrecognized option". Also, `IModule::findEntryPointByName` returns null unless the function has `[shader("compute")]`, and calling through that null crashes the harness. Repro source: /tmp/r12861/repro.cpp (ephemeral).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md`_
