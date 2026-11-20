---
type: chain
title: slang#13438 — SPIR-V OpacityMicromapIdKHR for RayQuery
description: Bot triaged 10-05→10-20 (Terminal); 11-19 maintainer kaizhangNV owns the fix via PR #14644
---

# slang#13438 — SPIR-V: no way to emit OpacityMicromapIdKHR for RayQuery

- Filed by mklefrancois; labels raytracing/reproduced/SPIR-V. Bot triaged 10-05 (repro on
  master `6ba151dcf`), 10-16 second repro (`e49310561`: constant RAY_FLAG_FORCE_OMM_2_STATE
  etc. add no micromap/culling capability), 10-20 Terminal status post (reporter's preferences
  A+C noted; ray-flag commenter offered a PR once direction set). No fixer chain was started —
  design call belonged to the maintainer.
- **2026-11-19: maintainer direction landed.** kaizhangNV (assignee) has open PR
  **#14644 "Support typed opacity micromap features on RayQuery"** (head
  `codex/ray-query-opacity-micromaps`) and explained the design to mklefrancois /
  albertrodriguezclo (cmt 7024939077): micromap features are expressed through Slang's type
  system as a second `RayQuery` template parameter — `RayQueryFeatures<RayQueryOpacityMicroMaps>`
  (e.g. via `typealias MicromapFeatures = …`) — instead of an HLSL-style enum flag, so the
  front-end capability system can check them; an enum would force `static_assert`-style
  `__target_switch` rejection on Metal, which they want to avoid. Tradeoff: more verbose syntax.
- **Disposition: nothing for the fleet.** The comment is human→human (no `@nv-slang-bot`
  mention — verified live; the webhook body matched the GitHub body verbatim). The fix is
  maintainer-owned. Do not dispatch a fixer on #13438, and treat #14644 as a human PR
  (non-`fix/issue-` head → pr-review-fix routing only on a real bot mention / reviewable event).
