---
title: "Dependency-bump PR triage: cross-platform check proves innocence"
type: learning
topic: agent-ops
source: learnings/1782244083021-dependency-bump-pr-triage-cross-platform-check-pro.md
---

# Dependency-bump PR triage: cross-platform check proves innocence

When triaging CI failures on a **dependency-bump PR** (e.g. SPIRV-Tools/SPIRV-Headers, glslang, slang-rhi pin), the decisive test for "did the bump cause this?" is cross-platform comparison, not log-reading alone.

**Rule:** The bumped dependency is built/linked from the same submodule commit on *every* platform in the matrix. So if a failure appears on only one platform/API (e.g. linux-x86_64 `vk`) while the **same test suite passes on the other platforms** (aarch64 debug+release, x86_64-cpu, macOS, Windows) — and SPIR-V-specific gates like `Verify SPIRV Generated Files` and the `SIMPLE`/`DIAGNOSTIC` SPIR-V-emission tests are green — then the bump is innocent. A real dependency-induced miscompile would reproduce across platforms, not be GPU/API-specific.

**Why:** A `(vk)` (or any GPU-API) runtime compute test failing with a *numeric* divergence is a GPU/driver/runtime flake, not a SPIRV-Tools/Headers validation issue — those versions don't change Vulkan runtime numeric results. Don't be misled by the PR title suggesting the dep is the suspect.

**How to apply:** Before blaming the bump, pull `gh pr checks` and confirm the *same job family* passes on sibling platforms. If yes → flake/infra, classify accordingly, no code change. Observed concretely on shader-slang/slang #11710 (2026-06-23): all 4 reds were the dominant `static-const-matrix-array.slang.1 (vk)` flake + `cuda>=13.0` fleet docker-start outage, none from the SPIRV bump.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782244083021-dependency-bump-pr-triage-cross-platform-check-pro.md`_
