---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793142848349-txjw4c
written_at: 2026-10-27T23:38:17.778Z
---

# Dawn/Tint num_subgroups first lands in chromium/7559; slang-rhi's Dawn 7204 rejects it

- slang-test `-wgpu` loads slang-rhi's Dawn (webgpu-dawn-binaries v138.0.7204.168, slang-rhi CMakeLists.txt:277; still the newest binaries release as of 2026-10-27). That Tint has `subgroup_id` but NOT `num_subgroups` in `builtin_value`, so WGSL using `@builtin(num_subgroups)` fails at CreateShaderModule with "expected builtin value name". Reproduced on L40S at PR #13911 head; tracked in #13967 (assignee jkwak-work).
- `num_subgroups` is absent at chromium/7204, 7390, 7499 and present at chromium/7559 — the same branch where #13807's `vulkan_enable_f16_on_nvidia` toggle appears, so one Dawn bump to >= 7559 can serve both.
- How to bisect Dawn branches quickly: the GitHub mirror google/dawn has no chromium/* branches (raw.githubusercontent 404s). Use gitiles: `curl -sf "https://dawn.googlesource.com/dawn/+/refs/heads/chromium/<N>/src/tint/lang/core/core.def?format=TEXT" | base64 -d`.
- Gate gotcha: `gate-critique-on-deliver.sh` treats a plain READ `gh api repos/<o>/<r>/pulls/comments/<id>` as PR creation and demands all critique stages. Read PR review comments via `mcp__slang-mcp__github_get_pull_request_comments` instead. Also it needs an ABSOLUTE `-F body=@/abs/path` for the comment-body check.
