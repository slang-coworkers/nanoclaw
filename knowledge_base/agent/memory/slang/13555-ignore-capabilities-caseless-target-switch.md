---
type: chain
title: "slang#13555: -ignore-capabilities + case-less __target_switch → silent UB"
description: "External bug (minco3), opened 2026-10-09. Triaged bug/high/P2, reproduced, long-standing. GO 2026-10-10 on Approach A (tag the missingReturn in specializeTargetSwitch, diagnose survivors after the final DCE) as a draft PR with Fixes #13555, routed through slang-triager. Dated readings in [[13555-history-rechases.md]]."
---

# slang#13555: `-ignore-capabilities` + case-less `__target_switch` → silent UB

**Origin.** minco3 (external, same reporter as [#13556](13556-cuda-samplegrad.md)) opened it 2026-10-09 23:11Z.
Under `-ignore-capabilities`, `SampleLevel`+offset, `SampleGrad`, and a `Buffer<T>` load on cuda/ptx compile rc 0.
The output is an infinite loop, an empty kernel, or a helper with no return. Without the flag they hit E36107.

**Routing.** Main session `sess-1791587498057-zjwoa9` dispatched to slang-triager on
`gh-issue-shader-slang/slang-13555`.

**Triage (slang-triager, 2026-10-10 00:53Z).** Comment
[6091831285](https://github.com/shader-slang/slang/issues/13555#issuecomment-6091831285). Checked on GitHub myself:
the comment is from the bot, labels are cuda+reproduced. Root cause checked in source at 08d419cbf:
`slang-ir-specialize-target-switch.cpp:73-88` emits `missingReturn` with no diagnostic unless `failedImplies`.
The rest are the triager's receipts (memo `triage-13555.md`, prototype diff in its `scratch-13555/prototype-B.diff`):
- Not a regression (2025.1 → 2026.16 identical). It also hits user-code `__target_switch` on
  cuda/cpp/metal/hlsl. cpp `Buffer<T>.Load` is an empty helper even without the flag.
- Erroring at specialize time is wrong: `sincos` false positive (`__sincos_metal` is linked before DCE). Erroring right
  after link-DCE gives torch/MS-texture false positives. Erroring after the final DCE is clean: 7755/7756, the one
  failure being gfx-smoke, which needs a GPU.

**Disposition (orchestrator, 2026-10-10 ~01:1xZ).** GO on Approach A as a draft PR with `Fixes #13555`, using the
standing proactive authority (drafts only). The reporter is external, nobody is assigned, there's no PR in flight,
and open PR #11225 touches only `slang-check-shader.cpp`. Routed through the triager, which owns the fixer edge.
- In scope: tag at the producer and a new error after the final DCE, ungated.
- Out of scope: the trap approach, the prelude stubs (#12630/#13377), and adding `case cpp:` to `Buffer<T>.Load`.
- PR body asks maintainers (1) whether the ungated scope makes this `pr: breaking change`, and (2) whether cpp
  `Load` should get a case instead of the error.
- My test note: draft #13559 adds a cuda `SampleGrad` case, so don't rely on it as the case-less repro. Use a
  user-code `__target_switch` or `Buffer<T>`.

**PR: draft [#13564](https://github.com/shader-slang/slang/pull/13564)** (2026-10-10, bot-authored on
`fix/issue-13555`; PR-mapped to slang-fixer `sess-1791593655069-w74ros`; both maintainer questions are in the
PR body and the explanation comment, cmt 6095450396).
- **Design (triager-accepted):** on SPIR-V/GLSL/WGSL, E41037 replaces E41009 inside `checkForMissingReturns`;
  every other target reports after the final DCE. Reason: with only the late check, a case-less function
  returning `Texture2D` segfaulted in `specializeResourceUsage`.
- **Breaking-change exposure (fixer):** cpp `Buffer<T>` loads; exported / `[DllExport]` functions on cpp;
  built-ins that were no-ops under the flag (`GroupMemoryBarrierWithGroupSync` on cpp, `debugBreak` on metal).
- **Two pre-existing crashes, out of scope and unfiled** (master 08d419cbf): spirv with
  `-disable-non-essential-validations` → rc 139; hlsl with `-ignore-capabilities` → rc 139. Only mentioned in
  the PR's explanation comment. Also unfiled: a duplicate E41037 per generic specialization, and the
  follow-up specializeCallSite crash (also on master).

**State (last verified 11-05 10:05Z):** draft at head `a4e7e33342` (merge of `100e058605` + master `04d2726db0`,
plus two test-only commits: `exit-code=-1` on 16 lanes for #14269's SIMPLE exit-code enforcement, and three
`-ignore-capabilities` lanes E41009→E41037 — the PR's intended effect; jkwak-work, the #13555 assignee, had
pinned those lanes in #14269). MERGEABLE, `pr: non-breaking`, 0 human reviews, CI 42005875266 waiting on its
gate. At head: `Decoration.noTargetCase` = **913**, min 38 / max 39. Fixer receipts at head (L40S, Debug):
48/48 new tests, full suite 11796/11799 (only the 3 fp8-cuda tests that also fail on master). The 11-16 04:39Z
re-check was auth-blocked (GitHub 401 outage). The 11-17 09:00Z re-check restored reads: head unchanged at
`a4e7e33342`, still draft, `pr: non-breaking`, 0 reviews, no new human comments — but now **CONFLICTING**, and
master moved to last id **914** with min=max=**42** (`Decoration.Artificial` = 913 collides with our
`noTargetCase` = 913). Merge-origin/master ask sent to the pinned triager session 11-17 09:03Z (delivered, its
seq 46): `noTargetCase` = **915**, min 42, max 43.
- **Collisions:** #13425 @ `e855bd5db0` (draft, MERGEABLE) claims 910 and shares **v39** — whoever merges second
  moves to 911/v40; #13872 @ `70cb286878` (draft, CONFLICTING) claims 910/v38. `slang-ir.h` can auto-merge to a
  version number master already uses, so check the number by hand.
- **Parked:** Q1 (breaking?) and Q2 (cpp `case cpp:`?) on the maintainers; Q3 (ready/merge) on the operator.
  **Ready-flip pending, on the weekly list** ([policy](../orchestrator/undraft-asks-replaced-by-weekly-list.md)).
- **Next:** triager→fixer executing the 11-17 merge-origin/master ask (`noTargetCase` 915 / 42–43); expect their
  [Report]/[Fix Report] on this thread. No further re-check scheduled — the chain is active again.

Dated re-chase readings, the collision evolution (909/36 → 910 → 913/39) and incident history live in
[[13555-history-rechases.md]] — new dated entries go there, never here.
