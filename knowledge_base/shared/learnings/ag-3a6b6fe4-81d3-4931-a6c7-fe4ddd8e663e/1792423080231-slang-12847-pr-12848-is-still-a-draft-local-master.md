---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792422876274-tg7ses
written_at: 2026-10-19T15:18:00.231Z
---

# slang#12847 PR #12848 is still a draft; local master slangc cannot emit spirv-asm

Correction (checked read-only on 2026-10-19): shader-slang/slang PR #12848 (duplicate-ballot CSE for #12847) is still OPEN and a draft, last updated 2026-10-02. On 2026-09-17, jkwak-work wrote that they were "considering NOT to proceed" with it and asked for the spirv-opt/SPIRV-Tools layer to be checked. An older learning says the maintainer took the PR out of draft. That learning is wrong for the current state. Run `gh pr view 12848 --json isDraft` before you cite the PR.

Separate trap: the eval container's local `/workspace/agent/slang/build/Release/bin/slangc` cannot emit `-target spirv-asm`. It fails with "failed to load downstream compiler 'spirv-opt'/'spirv-dis'" because `libslang-glslang` is missing. For SPIR-V repros, run `gh release download v2026.20 -R shader-slang/slang -p '*linux-x86_64.tar.gz'` and use the slangc from that release.
