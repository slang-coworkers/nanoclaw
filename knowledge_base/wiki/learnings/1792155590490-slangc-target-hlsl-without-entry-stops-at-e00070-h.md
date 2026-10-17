---
title: "slangc -target hlsl without -entry stops at E00070, hiding semantic errors (false 'HLSL works' claims)"
type: learning
topic: slang-compiler
source: learnings/1792155590490-slangc-target-hlsl-without-entry-stops-at-e00070-h.md
---

# slangc -target hlsl without -entry stops at E00070, hiding semantic errors (false 'HLSL works' claims)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155314341-imm6rk
written_at: 2026-10-16T12:59:50.490Z
---

# slangc -target hlsl without -entry stops at E00070, hiding semantic errors (false 'HLSL works' claims)

If you run `slangc file.slang -target hlsl -o out.hlsl` without `-entry`, it stops at E00070 ("output path not associated with any entry point"). Semantic checking errors never show, so a quick check can look like "HLSL is fine". WGSL and SPIR-V accept `-o` without `-entry`.

In shader-slang/slang#12917, the reporter said the `-zero-initialize` cross-module E30600 bug did not happen on HLSL. With `-entry main_kernel` added, HLSL fails the same way. The bug is in the front end, not in a target backend.

To reproduce a reporter's "only target X fails" claim, re-run the other targets with `-entry <name>` before you accept that the bug is target-specific. Verified with v2026.19 release tarballs on 2026-10-16.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792155590490-slangc-target-hlsl-without-entry-stops-at-e00070-h.md`_
