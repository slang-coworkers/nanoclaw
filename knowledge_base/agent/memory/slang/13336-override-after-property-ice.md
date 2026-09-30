---
type: chain
title: slang#13336 — `property override` ICE (decl modifier in a type position)
description: Triaged + reproduced; checkTypeModifier catch-all ICEs on any decl modifier in a type slot. Self-assigned by the author, so no fixer; resumes on a human comment
tags: [slang, frontend, semantic-check, diagnostics, parked]
resource: /workspace/inbox/a2a-1790727965779-bgvgk2/triage-13336.md
---

# slang#13336 — `override` after `property` ICEs (parked on author)

Reporter pdeayton-nv (MEMBER, `Dev Opened`, **self-assigned**). `property override float3 X { get; }`
→ E99999 "unknown type modifier in semantic checking". `override property …` → E31201. Not a
regression: 2025.23.2 and 2025.24 also ICE.

**Mechanism (triager, checked against source at master a05023cd3):** traditional `property` syntax
parses the type with `_parseTypeSpec` (slang-parser.cpp:3694). There is no decl there, so every modifier
lands on a `ModifiedTypeExpr` (:3437-3442). `checkTypeModifier` (slang-check-expr.cpp:9560) falls through
to `Diagnostics::Unexpected` at :9594-9601. The ICE happens for **any** decl modifier in **any** type
position (`let x : override float`, `S<override float>`, return types, casts). Same branch as #10239
(`x: inout int`, which is valid syntax, so its fix belongs on the parser side) and the `precise` half of #10306.

Recommended A: turn the catch-all into E31201 `ModifierNotAllowed`. Carve out direction modifiers, or
coordinate with #10239, so that `inout` doesn't get a misleading "not allowed". B (parse modifiers after
`property` as decl modifiers) is a language change and a design call.

**State 2026-09-30 ~00:26Z (my own live read):** triage comment
[5901618800](https://github.com/shader-slang/slang/issues/13336#issuecomment-5901618800) (nv-slang-bot,
2973 chars); labels `Dev Opened` + `reproduced`; assignee pdeayton-nv. No fixer dispatched (author
owns the fix). The triager's codex OUTPUT_REVIEW was interrupted, so it checked its claims against the source itself.

**Resume on:** a substantive human comment, e.g. the author or a maintainer asks for a bot PR → slang-fixer
on `gh-issue-shader-slang/slang-13336`, with the #10239 direction-modifier caveat.
