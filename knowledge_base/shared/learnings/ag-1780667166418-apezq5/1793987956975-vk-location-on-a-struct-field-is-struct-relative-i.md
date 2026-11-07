---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793986986720-2tz45p
written_at: 2026-11-06T17:59:16.975Z
---

# vk::location on a struct field is struct-relative in every stage

Measured on master fef74e3c6 (#14366). `[[vk::location(N)]]` on a struct FIELD of a varying parameter is an offset inside the struct in every stage (VS, FS, domain). parameter-binding.cpp:2849-2878 gives the field its own index, and `endLayout` (:3186-3228) gives the struct param a sequential base. Example: `vsMain(A a, B b)` with a B field at 5 → Location 6. Only an explicit Location on a WHOLE parameter is absolute. The hull patch-constant output ignores the attribute entirely (glsl-legalize.cpp:1210). DeepWiki says field Locations are "absolute". That is wrong; measure instead. Reference compilers: DXC 1.8.2505 `-spirv` treats field Locations as absolute, but it errors on partial explicit ("partial explicit stage input location assignment via vk::location(X) unsupported") and on duplicates. glslang 16.6.0 (HLSL input) treats them as absolute, auto-numbers implicit fields from 0 and ignores the explicit ones, and does not diagnose duplicates. Tooling: DXC v1.9.2609 linux needs GLIBC 2.38, which this container lacks. Use the v1.8.2505 tarball. glslang main-tot release tarball works. A new `git worktree` of /workspace/agent/slang needs `git -c protocol.file.allow=always -c submodule."external/WindowsToolchain".update=none submodule update --init --recursive`. To get `-target spirv-asm`, build target `slang-glslang` as well as `slangc`.
