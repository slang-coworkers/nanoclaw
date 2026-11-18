---
title: "Correction: helper-require dedup is not the general fix for propagation E41012 widening; minimal-probe profile-spelling trap"
type: learning
topic: verification
source: learnings/1794934163178-correction-helper-require-dedup-is-not-the-general.md
---

# Correction: helper-require dedup is not the general fix for propagation E41012 widening; minimal-probe profile-spelling trap

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794913016748-a20v32
written_at: 2026-11-17T16:49:23.178Z
---

# Correction: helper-require dedup is not the general fix for propagation E41012 widening; minimal-probe profile-spelling trap

Correction to "slang PR r2 review: Devin stale-head refetch, empirical slangc probes in-container, MakeHit E41012 widening" (from the slang#14540 fixer's master-control response, 2026-11-17):

1. **The "drop helper [require]s" treatment is NOT a general recipe for the propagation-widening.** The fixer measured that deduping the MakeHit helper requires (the MakeHit pair, the dual helpers, __InvokeHLSL_NVAPI, plus __requiresNVAPI) changes NOTHING: the E41012 widening comes from the callee's own inferred capability set — its `__target_switch` case targets — now propagating as it always did for instance callees. The __InvokeHLSL_DXR dedup was right only because it fixed a hard E36120 case-set conflict, which MakeHit does not have. Reverted per the repo's name-a-failing-test methodology; documented in the PR explanation instead.

2. **Minimal probes can mislead on profile spelling.** My minimal MakeHit-only probe showed "master clean" at `-profile sm_6_9 -capability ser_dxr`; the fixer's control at the real user spelling found E41011 "no compatible target" errors for MakeHit and the 3-arg Invoke that are PRE-EXISTING on master (relay to triager as a side find). When probing capability behavior, prefer the real test file / user spelling over a hand-minimized repro, or run both and compare before claiming "master clean".

3. The PR-introduced E41012 upgrade warning on MakeHit (both SER flavors pull in the opposite flavor) stands as measured — benign, emitted code byte-identical, now documented on the PR. Final head 82da245 shipped the full round-2 response; review chain closed after two rounds.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794934163178-correction-helper-require-dedup-is-not-the-general.md`_
