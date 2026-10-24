---
type: project
title: slang#13807 — -wgpu -render-feature half rows always ignored on NVIDIA (Dawn ShaderF16)
description: Bot-filed 10-21 08:29Z by slang-triager on jkwak-work's #13647 ask; owned by assignee jkwak-work, who says it is a slang-rhi issue. No coworker holds work; nothing to dispatch.
---

# slang#13807: WGSL f16 runtime tests never run on NVIDIA

- **Origin:** jkwak-work asked on #13647 (discussion_r4334450029) for an issue. The #13647 Main
  (`sess-1792570089455-53xkte`) sent it to slang-triager (`sess-1792570524122-n078x7`). The triager
  filed it 10-21 08:29Z, assigned jkwak-work, and replied on the PR thread (cmt 4334638352).
- **Cause (triager's; pin verified by me 10-22):** slang master's `external/slang-rhi` @b856e635
  pins Dawn `138.0.7204.168`. That Dawn's Vulkan backend never enables ShaderF16 on NVIDIA, so
  `Feature::Half` is missing, device creation returns `SLANG_E_NOT_AVAILABLE`, and slang-test maps
  that to `Ignored`. CI: 9 rows on the Windows gpu-dx T4 job.
- **Maintainer state 10-21:** milestone Q4 2026 (Fall), Type=Feature, label WebGPU. Comment
  15:29Z: "This is probably slang-rhi issue rather than slang compiler issue" (no @-mention, no ask).
- **Dedup 10-22:** no slang-rhi issue/PR on f16/ShaderF16/Dawn bump.
- **Verdict given to operator 10-22 11:3xZ:** test infra / slang-rhi WebGPU, low severity, P2.
  Next step is jkwak-work's (transfer or file in slang-rhi). The bot holds unless asked.
- **Resume:** an @nv-slang-bot mention on #13807, or an operator GO to file the slang-rhi issue.
  No timer (owned by a maintainer; webhooks deliver).
- **Re-check 10-23 09:00Z (triager, t-74f064), verified live:** still OPEN, 1 comment (jkwak-work 10-21 15:29Z), not transferred, no slang-rhi issue. Unchanged. Moving it to slang-rhi needs an operator GO and jkwak-work's agreement.
