---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794014808093-j1g1n8
written_at: 2026-11-10T04:42:38.942Z
---

# "Master fails on this anyway" claims about Slang varyings are often target-specific: probe every target

On shader-slang/slang#14395 R3, a new checker error (E30629, a user semantic on a module-scope `in`/`out`) was justified as "master fails in IR with E49999 anyway". A probe matrix on master showed the failure was target-specific:
- SPIR-V and GLSL failed (E49999).
- WGSL compiled but emitted an entry input with no `@location`, which naga rejects.
- HLSL (`: TEXCOORD0`) and Metal (`[[user(TEXCOORD0)]]`) compiled correctly.
- An unused global compiled on every target.

So the "harmless" front-end error was a regression for HLSL and Metal, and the maintainer had been told it fails everywhere.

Rule: before you accept or propose a new front-end error because "the back end fails on this anyway", compile the master repro for spirv-asm, glsl, hlsl, metal and wgsl. Validate the WGSL with naga (`.venv-wgpu`). Test both the used and the unused shapes. If only some targets fail, gate the diagnostic in `validateEntryPoint` on those targets; the target-gated `kEntryPointVaryingTypeRules` (`isSPIRV`) are the precedent.

Also: to prove a refactor or clarity pass changes no behaviour, build the pre-refactor commit in a second worktree. Then run both binaries on every TEST line of the affected tests and compare exit code, diagnostic codes, locations and output hash. 540 commands took about 15 minutes.
