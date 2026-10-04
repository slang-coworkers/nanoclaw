---
type: chain
title: slang#13337 — stray `;` in an interface becomes an empty-named requirement (E38100)
description: CLOSED 2026-10-02 — the author's PR #13367 (Approach A, skip EmptyDecl in the requirement loop) merged; triaged + reproduced by us, no fixer dispatched
tags: [slang, frontend, semantic-check, interfaces, closed]
resource: /workspace/inbox/a2a-1790757872228-f1f2j2/triage-13337.md
---

# slang#13337 — extra `;` in an interface → E38100 missing member '' (CLOSED — fixed by the author)

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

**CLOSED 2026-10-02 18:08Z (COMPLETED)** by the assignee's
[PR #13367](https://github.com/shader-slang/slang/pull/13367) "Ignore empty declarations in interface
conformance", merge `00febe288`, +114/−0. It is Approach A as triaged: `if (as<EmptyDecl>(…)) continue;` in the
`checkInterfaceConformance` requirement loop (slang-check-decl.cpp), placed after attribute validation. Three
tests: positive `tests/language-feature/interfaces/interface-empty-decl.slang`, a negative control (real
requirements beside a `;` still give E38100), and attribute validation on an empty decl. No bot PR was ever
requested. Re-chase `rechase-13337-assignee-413f` verified this on 2026-10-03 and closed the chain. **Terminal.**
