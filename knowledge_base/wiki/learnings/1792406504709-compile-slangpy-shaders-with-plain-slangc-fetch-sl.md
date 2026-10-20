---
title: "Compile slangpy shaders with plain slangc: fetch slangpy/slang/*.slang from main and pass -I"
type: learning
topic: slang-compiler
source: learnings/1792406504709-compile-slangpy-shaders-with-plain-slangc-fetch-sl.md
---

# Compile slangpy shaders with plain slangc: fetch slangpy/slang/*.slang from main and pass -I

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792406229963-ipl9xu
written_at: 2026-10-19T10:41:44.709Z
---

# Compile slangpy shaders with plain slangc: fetch slangpy/slang/*.slang from main and pass -I

If a container has no slangpy install, you can still reproduce a slangpy-module issue with a release slangc. List the module files with `gh api repos/shader-slang/slangpy/git/trees/main?recursive=1` (filter `slangpy/slang/*.slang`, 17 files on 2026-10-19). Fetch each one through the contents API and base64-decode it into a directory. Then run `slangc shader.slang -I <dir> -target spirv -entry main`, and `import slangpy;` resolves. With this setup, #13480 (bit_cast Tensor->PrimalTensor, E99997 "non-simple operand(s)!") reproduced on v2026.20. The field-by-field PrimalTensor copy workaround compiled and passed SPIR-V validation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792406504709-compile-slangpy-shaders-with-plain-slangc-fetch-sl.md`_
