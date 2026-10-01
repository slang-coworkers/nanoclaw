---
type: chain
title: slang#13337 — stray `;` in an interface becomes an empty-named requirement (E38100)
description: Triaged + reproduced; the checkInterfaceConformance deny-list lets EmptyDecl through as a requirement. Self-assigned by the author, so no fixer; resumes on a PR/human comment or the re-chase
tags: [slang, frontend, semantic-check, interfaces, parked]
resource: /workspace/inbox/a2a-1790757872228-f1f2j2/triage-13337.md
---

# slang#13337 — extra `;` in an interface → E38100 missing member '' (parked on author)

Reporter pdeayton-nv (MEMBER, `Dev Opened`, **self-assigned**). This is the sibling of
[#13336](13336-override-after-property-ice.md): same reporter and profile, filed the same morning.
`interface IFoo { property float3 X { get; }; }` makes every conformer fail with E38100
"does not provide required interface member ''" and a note "see declaration of 'empty'". Not a regression:
2025.20–2025.24 fail the same way.

**Mechanism (triager, checked against master 16c3d3f68):** the parser turns a bare `;` into an `EmptyDecl`
(slang-parser.cpp:6011-6020). The nesting table deliberately allows that inside an interface
(slang-check-decl.cpp:267). The catch-all requirement loop in `checkInterfaceConformance`
(slang-check-decl.cpp:11652-11669) is a deny-list, so the `EmptyDecl` falls through into
`findWitnessForInterfaceRequirement` and E38100 fires. IR lowering's allow-list
`shouldDeclBeTreatedAsInterfaceRequirement` (slang-lower-to-ir.cpp:1683-1720) already returns false for it,
so only the checker disagrees.

Recommended A: skip `EmptyDecl` beside the InheritanceDecl/InterfaceDefaultImplDecl skips, plus a positive
compile test. The triager prototyped it and reverted: repros rc 0, the negative control still
E38100, language-feature + diagnostics 2615/2615. B (a shared allow-list predicate) is an optional follow-up.
C (dropping the `;` in the parser) was rejected as the wrong layer.

**State 2026-09-30 08:44Z:** triage comment
[5907554679](https://github.com/shader-slang/slang/issues/13337#issuecomment-5907554679) (nv-slang-bot);
labels `Dev Opened` + `reproduced`, Type=Bug; assignee pdeayton-nv. **No fixer dispatched** (the author
owns the fix; self-assigned maintainer ⇒ stand down, see #13336 and #12221). The chain was interrupted by the
00:21Z gateway false alarm and resumed 08:31Z. The triager re-ran root cause, and only then posted.

**Resume on:** a PR from the assignee, a human comment asking for a bot PR (→ slang-fixer on
`gh-issue-shader-slang/slang-13337` with the memo), or the re-chase `rechase-13337-assignee-413f`
(2026-10-03, which also sweeps #13336).
