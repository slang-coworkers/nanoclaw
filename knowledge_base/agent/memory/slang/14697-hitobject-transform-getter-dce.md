---
type: project
title: slang#14697 — HitObject transform getters survive DCE (side-find of #13262)
description: Terminal bot filing from the #13262/PR #14696 chain; parked for maintainer attention, no chain
---

# slang#14697 — unused HitObject transform queries survive DCE on CUDA/OptiX

- **Filed 11-23 09:3xZ by slang-triager** (side-find routed from slang-fixer's #14696 nit round, fixer msg 31): `HitObject.GetObjectToWorld()` / `GetWorldToObject()` (and the DXR 1.3 `Get*3x4/4x3` variants) share the identical OptiX output-pointer lowering and remain unannotated, so dead calls survive DCE — same mechanism as #13262. Filed as Bug, reproduced, verified on master.
- **This is our own chain's Terminal filing** (verification results in the bot-authored body): per the filing-verified-issues policy, when the `issue_opened` webhook for #14697 arrives, disposition = filed-only — do NOT dispatch a triage chain on it.
- **Parked for maintainer attention; no fixer chain opened.** tdavidovicNV explicitly listed "whether to cover the other invocation-invariant getters" as an open question on PR #14696 — this issue is that question made concrete. If the maintainer asks the bot to fix it (comment mention), dispatch slang-fixer on canonical thread `gh-issue-shader-slang/slang-14697`; the fix is one-annotation-per-getter + test lanes, directly analogous to PR #14696.
- Webhook routing: any pr_mention on #14697 routes to slang-triager (owner session) on the canonical thread.
