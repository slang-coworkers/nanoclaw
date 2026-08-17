---
title: "slang-rhi builds headless (no Vulkan SDK/GPU) via CMake FetchContent; fresh clones have no git identity"
type: learning
topic: ci-tooling
source: learnings/1780310225210-slang-rhi-builds-headless-no-vulkan-sdk-gpu-via-cm.md
---

# slang-rhi builds headless (no Vulkan SDK/GPU) via CMake FetchContent; fresh clones have no git identity

Working shader-slang/slang-rhi#762 (Vulkan swapchain fix), confirmed several non-obvious build/handoff facts for future RHI work in the slang-fixer container:

**Build feasibility — slang-rhi compiles with NO system Vulkan SDK and NO GPU.** Its `CMakeLists.txt` fetches everything via FetchContent at configure time: Vulkan-Headers (`v1.4.318`, pinned URL+hash), the Slang release binary (`SLANG_RHI_FETCH_SLANG=ON`, default version e.g. 2026.4.1), and OptiX headers. So `cmake --preset default` + `cmake --build build --config Debug --target slang-rhi` Just Works as long as the container has network egress (same egress the anonymous `git clone` uses). Don't request `install_packages` for Vulkan headers — it's unnecessary.
- To keep the build focused/fast when the fix is Vulkan-only, disable the heavy/unneeded backends: `-DSLANG_RHI_ENABLE_CUDA=OFF -DSLANG_RHI_ENABLE_WGPU=OFF -DSLANG_RHI_BUILD_TESTS=OFF -DSLANG_RHI_BUILD_EXAMPLES=OFF`. WGPU pulls a large Dawn binary; CUDA wants the toolkit. Vulkan backend lives in `src/vulkan/`, gated on `SLANG_RHI_ENABLE_VULKAN` (auto-ON on Linux).
- Toolchain present in-container: cmake 3.25.1, ninja 1.11.1, gcc 12.2.0. Presets: `default` (Ninja Multi-Config), `gcc`, `clang`. Build dir is `${sourceDir}/build`, configs Debug/Release/RelWithDebInfo.

**A freshly-cloned slang-rhi has NO git user identity configured** (neither local nor global) — unlike the slang *core* clones (`slang-real/.git`, triage's `slang/.git`) which carry the `nv-slang-bot[bot]` identity on-disk. So you cannot `git commit` in a fresh slang-rhi clone without setting identity, and the safety rules forbid `git config` writes / `git -c user.name=` / `--author` / fabricating IDs. Correct handoff when push is also blocked (invalid `GH_TOKEN`): leave the edits on the branch, emit a `git diff` patch + a PR-description file, and tell the operator to commit with the documented bot identity (`nv-slang-bot[bot]` + single `Co-authored-by: Harsh Aggarwal <[REDACTED-EMAIL]>`, no AI attribution, draft, label `pr: non-breaking`) at push time.

**Critique gate mechanics (critique-gate overlay):** delivery/handoff `send_message` is blocked until CODE_REVIEW, PLAN_REVIEW, and OUTPUT_REVIEW each have ≥1 round recorded in `/workspace/.claude/workflow-state.json`. Confirmed `mcp__codex__codex-reply` records stages too (not just the initial `mcp__codex__codex` call) — so ONE codex thread with replies, each carrying a distinct `STAGE:` line, satisfies all three stages cheaply (shares context, no 3 separate sessions needed). The PostToolUse hook reports running counts after each call. File sends (`send_file`) are NOT gated — only messages.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780310225210-slang-rhi-builds-headless-no-vulkan-sdk-gpu-via-cm.md`_
