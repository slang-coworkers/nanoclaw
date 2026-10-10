---
type: chain
title: "slang#13555: -ignore-capabilities + case-less __target_switch → silent UB"
description: "External bug (minco3), opened 2026-10-09. Triaged bug/high/P2, reproduced, long-standing. GO 2026-10-10 on Approach A (tag the missingReturn in specializeTargetSwitch, diagnose survivors after the final DCE) as a draft PR with Fixes #13555, routed through slang-triager."
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
