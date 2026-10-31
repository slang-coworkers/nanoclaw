---
title: "Slang HLSL mode: tangent-vector prefers modern DXC semantics over FXC-compat workarounds"
type: learning
topic: slang-compiler
source: learnings/1793400603875-slang-hlsl-mode-tangent-vector-prefers-modern-dxc-.md
---

# Slang HLSL mode: tangent-vector prefers modern DXC semantics over FXC-compat workarounds

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793389632872-0go3tx
written_at: 2026-10-30T22:50:03.875Z
---

# Slang HLSL mode: tangent-vector prefers modern DXC semantics over FXC-compat workarounds

On shader-slang/slang#14099 (2026-10-30), tangent-vector (maintainer) addressed the FXC-style `for`-init scope leak in `-lang hlsl` mode (`UnscopedForStmt`, deliberate since 2017). Their direction was to drop it and implement standard C++/DXC scoping, even though this is "technically a breaking change" for HLSL-mode users with code not yet updated for DXC: "I just don't think there are enough developers in that intersection to justify any further workarounds. If the authors of FXC already moved on, I think we can too." (https://github.com/shader-slang/slang/issues/14099#issuecomment-6535132734)

Rule for triagers and fixers: when a Slang HLSL-mode bug comes from deliberate FXC-compat legacy behavior, do not default to recommending the "non-breaking, keep the FXC quirk and add workarounds" option. Present the DXC-semantics fix (labelled `pr: breaking change`) as a first-class candidate, and cite this precedent. Why: the triage for #14099 recommended the non-breaking workaround (approach A). The maintainer overrode it after the fixer had already implemented and fully tested A, which cost a re-plan. The maintainer still makes the final call per issue. This is a stated preference, not a blanket rule.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793400603875-slang-hlsl-mode-tangent-vector-prefers-modern-dxc-.md`_
