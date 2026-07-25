---
name: project_12210_autodiff_property_getter_frontend_crash
description: "#12210 slangc front-end crash — [Differentiable] on struct property getter, no diagnostic; regression from #5922"
metadata: 
  node_type: memory
  type: project
  originSessionId: ca1f3ab5-7512-490a-9afd-11dec729552d
---

**shader-slang/slang#12210** — `[Differentiable]` (or ANY differentiability attr) on a **property** accessor segfaults slangc in the FRONT-END with no diagnostic / no line (Windows `0xC0000005` = error 3221225477). External reporter qwerty10086, self-contained repro (autodiff property getter + CUDA/slangtorch, but crash reproduces bare).

- **Classification:** bug (crash) / high / frontend (semantic-check → autodiff decl-header) / **P1**.
- **Minimal repro:** `struct S { property V : float { [Differentiable] get { return 1.0; } } }` — no CUDA, no `__fwd_diff`, decl never used. **Subscript** accessor with `[Differentiable]` is fine → property-vs-subscript is the discriminator.
- **Root cause (CONFIRMED, symbolized bt + git-blame):** `getFuncType` (slang-syntax.cpp:1124) enters `if (as<SubscriptDecl>(parent) || as<PropertyDecl>(parent))`, then does `parent.as<CallableDecl>()` and iterates params. `SubscriptDecl` IS a `CallableDecl` (index params); **`PropertyDecl` is a `ContainerDecl`, NOT callable** → walking it as CallableDecl null-derefs at slang-ast-decl.cpp:247 (`isUsingOnDemandDeserialization`). Regression from commit **e93cb8a4d (#5922, 2024-12)** — matches reporter's v2023.4.10→v2026.12.2 window.
- **Fix (triager recommended):** **A** = gate the param-prepend branch on `as<SubscriptDecl>(parent)` only (a property contributes no params; accessor's own param loop already handles a setter's value). Plus **C** = add assert/diagnostic so out-of-contract parents fail loudly (addresses "crash with no diagnostic").
- **Extra discriminators:** even `[TreatAsDifferentiable]` and an empty `get;` in an interface crash → purely front-end, not an IR/autodiff pass.
- **Status 07-24:** triager applied `reproduced`+`regression`, set Type=Bug, posted 5-bullet verdict ([comment 5068086148](https://github.com/shader-slang/slang/issues/12210#issuecomment-5068086148)), forwarded to **slang-fixer** on canonical thread. slang-fixer ACK'd, building Approach A + hardening (~20min ETA from 09:01). Triager holding for [Fix Report] to roll up. Related to autodiff cluster [[project_12197_rayquery_byvalue_return_nrvo]] but distinct. Merge OPERATOR-gated per usual.
