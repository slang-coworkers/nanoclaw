---
type: chain
title: "slang#13169 — bwd_diff hang on runtime-bound loop (from slangpy#1167)"
description: "CLOSED 2026-10-09 by saipraveenb25: fixed on master by #13234 (dup of #13226). slangpy#1167 still open, waiting on the CUDA grad_sum=320 check."
---

# slang#13169: bwd_diff runtime-bound loop hang

- **Terminal:** saipraveenb25 closed it as completed on 2026-10-09 20:43Z with "Looks like it's been fixed."
  (comment 6088934503). That confirms the bot verdict in comment 5881003685: fixed on master by #13234, a duplicate
  of #13226. It was verified without a GPU: the compile A/B no longer hangs and the CPU gradients total 320.
- **Routed 10-09:** slang-triager, session `sess-1789716151214-yz6n7y`, posted the [Resolution] as comment 6089027709 (20:50Z). The triager chain is closed. slangpy-fixer,
  session `sess-1789719798342-ukgccz`, owns closing slangpy#1167. The CUDA `runtime` variant must print
  `bwds ok grad_sum=320` on a build that contains #13234, so the close needs a GPU.
- **Re-chase:** `rechase-slangpy-1167-gpu` on 10-16 checks the GPU blocker; slangpy-fixer reported no GPU at 10-09 20:48Z.
- **Cancelled:** re-chase `rechase-slang-13169-1330-0772`, which bundled this close with #13301. #13301 is still
  saipraveenb25 answered on 10-09 at 21:10Z with a question instead of an (a)/(b) pick: does removing `[Differentiable]`
  from functions with a custom derivative work? He says that is the intended usage, and the double-conformance bug
  should still be fixed. slang-fixer was dispatched to test it and draft a reply (pinned to `sess-1789716207340-dwbdoz`;
  posting goes through slang-triager if fixer's gh is still `app_not_connected`). Re-chase: `rechase-slang-13301-huma-3af4` (10-11 09:00Z).
- **Spin-offs:** the #9808 autodiff cluster, recorded in [13332-second-order-nodiff-scope.md](13332-second-order-nodiff-scope.md).
