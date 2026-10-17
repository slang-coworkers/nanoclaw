---
type: project
name: project_13306_global_uniform_as_temporary_hlsl_gec
description: "#13306 (HLSL -Gec: global uniforms writable as per-invocation statics) — CLOSED 2026-10-08 by tangent-vector's own PR #13445 (merged); resource prereq #13116 merged 10-14. Triaged by us 09-29 (cmt 5882041497), never dispatched (maintainer-owned design). Closed-chain record + the triage findings the shipped design confirmed."
metadata:
  node_type: memory
  type: project
---

# #13306 — global uniforms as temporaries in HLSL mode (`-Gec`) — CLOSED

**Outcome (verified 2026-10-17):** closed 2026-10-08 01:33Z by `tangent-vector` (author + self-assignee) when
his PR **#13445** "Support HLSL uniform parameter temporaries with -Gec" merged. The resource-global prereq,
draft PR **#13116** (`legalizeResourceGlobalVars`, `Fixes #13074`), merged 2026-10-14. No bot action
after our triage, and none needed: the gate task `recheck-slang-13306-e7c4` is no longer in Main's
`ncl tasks list` (10-17), and `scripts/recheck-13306.sh` is a leftover.

## Chain record

- 2026-09-29: triaged by `slang-triager` on thread `gh-issue-shader-slang/slang-13306`. Comment **5882041497**
  passed codex OUTPUT_REVIEW in 3 rounds (REJECT → APPROVE_WITH_EDITS → APPROVE). I verified the bot
  author and the 2058-char body. Type set to Feature; the human `Dev Opened` label was left alone.
- No fixer: the parent directive said read-only, and the maintainer owned the design (he sketched it in the body).

## What the triage found, and what shipped

The feature: FXC/DXC `-Gec` lets code assign to a global uniform (`uint x;` or a legacy `cbuffer`
member). The write goes to a per-invocation `static` that is initialized from the parameter.

- **The checker already named the feature.** The TODO at `getTypeForDeclRef` (`slang-check-decl.cpp:1666-1676`,
  @ `f3775b9a5`) proposed "immutable parameter + global variable initialized from it". It named the blocker,
  resource-typed globals. Writes are rejected with `E30011` (left of '=' is not an l-value).
- **Resource-typed params were the real hazard.** Today `static Texture2D t = tp;` and similar cases give
  `E30076 global variable cannot have opaque type` on every target (`checkVarDeclCommon`). #13116 also
  excluded parameter groups, acceleration structures, and structs that contain resources. So a desugar
  that ignored types would have regressed read-only code that compiles today. We proposed
  mitigation (1): a checker-side type split that keeps unsupported-typed params as plain params.
- **The shipped design matches mitigation (1).** In #13445 the parser introduces a
  `UniformParameterShadowVarDecl`. When the type cannot be a mutable `static`, semantic checking treats
  the shadow as an **immutable alias** and rejects writes, so reading `Texture2D gTex;` under `-Gec`
  still works. Reflection keeps the original inputs and bindings, and the option has no effect on Slang
  or GLSL input.
- **Perf note we measured:** a whole-cbuffer `static` copy with a dynamic index keeps a full aggregate
  `OpLoad` even after spirv-opt at `-O2`. Slang IR has no SROA pass, so a large CB needs targeted load
  forwarding.

Related HLSL-compat opt-ins by the same maintainer: #13073 (methods mutable by default), #12836 (per-TU
source language). Sibling chain on the same parser area: [[project_13496_unify_struct_class_parsing]].
