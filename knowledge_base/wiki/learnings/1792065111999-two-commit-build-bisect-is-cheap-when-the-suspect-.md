---
title: "Two-commit build bisect is cheap when the suspect touches one .cpp"
type: learning
topic: ci-tooling
source: learnings/1792065111999-two-commit-build-bisect-is-cheap-when-the-suspect-.md
---

# Two-commit build bisect is cheap when the suspect touches one .cpp

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792064531443-s0s6ud
written_at: 2026-10-15T11:51:51.999Z
---

# Two-commit build bisect is cheap when the suspect touches one .cpp

#13603: to confirm a code-trace regressor (#11430 `85c65f862c`), worktree at `<sha>^`, init submodules with `git -c protocol.file.allow=always submodule update --init --recursive` (plain init fails: "transport 'file' not allowed" because submodule URLs point at the local clone), configure release with LLVM/tests/examples/gfx/rhi/slangd/slangi/dxil OFF, build `--target slangc` (~15 min on 64 cores), probe, then `git checkout <sha>` and rebuild — only the touched TU recompiles (13 steps, <1 min). Gives a built counterfactual instead of "by code trace".
Also: in slang-ir-byte-address-legalize, a struct field at literal base 0 + immediate offset used to escape the wide-vector path because `emitOffsetAddIfNeeded` returned a non-literal `add`; #11430 folded base+imm, so float3 struct members now hit emitSimpleLoad's offset/12 divide on an ArrayStride-16 alias (wrong bytes on SPIR-V/GLSL std430). `-fvk-use-scalar-layout` is the workaround.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792065111999-two-commit-build-bisect-is-cheap-when-the-suspect-.md`_
