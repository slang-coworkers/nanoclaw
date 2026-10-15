---
type: project
name: project_13627_extension_conformance_not_imported_hint
description: "slang#13627 (HildarTheDorf, external, 10-14 20:03Z): E38029 'float does not conform to IScalarFractional' when the conformance comes from an extension in a module the CALLER doesn't import (srgb imports slang.numerics, consumer imports only srgb). Triaged 10-14 (cmt 6177812514): diagnostic UX, not a lookup bug, since visibility follows caller imports per the spec and tests/diagnostics/extension-visibility.slang. Rec A = a 'conformance exists in loaded-but-unimported module X' note. Fixer HELD; operator go/no-go asked. Re-check recheck-13627-import-hin-bf8f on 10-21."
metadata:
  node_type: memory
  type: project
---

# slang#13627: "doesn't conform" when the conformance's module isn't imported

**Report.** Module `srgb` does a plain `import slang.numerics;` and exports
`srgbToLinear<T> where T : IScalarFractional & …`. A consumer that imports only `srgb` gets E38029 ×3. The reporter wants a
"did you forget to import" hint; the alternative they offer is to resolve the bound via the callee's module.

**Triage (slang-triager, thread `gh-issue-shader-slang/slang-13627`, cmt 6177812514, 20:31Z; memo row 10).**
- Reproduced at master `6d38185bc`. Adding `import slang.numerics;` or `__exported import` in srgb fixes it.
- Not numerics-specific: any `extension float : IFoo` in an unimported module fails. A conformance on the type itself is found.
  I verified the user-module analog myself with the local Release slangc (E38029 without `import ifaces`, rc 0 with it).
- By design: `getCandidateExtensionsForTypeDecl` (slang-check-decl.cpp:18684-18701) reads `importedModulesList`, and
  `importModuleIntoScope` recurses only through `__exported` (:18262-18270, verified). Spec declarations.md:770-771 and the
  pinned test `tests/diagnostics/extension-visibility.slang` say the same. Not a regression (the message changed from E39999 in 2026.19).
- The overload complaint is likely an old build: master names the first failing interface per candidate (E40022, #12969).
- **Unfiled side hazard:** a non-generic sibling overload silently wins when the generic is rejected (`callFoo(int)` → only an
  E30081 warning; `callFoo(float3)` → nothing). The import set silently changes overload choice.
- Labels set: reproduced + Diagnostic Output; Type=Feature.

**Options.** A [rec]: a note on the E38029/E40022 paths naming the loaded-but-unimported module (prototype +61/−1, reverted;
gaps: prints `numerics` not `slang.numerics`; no transitive/generic-extension coverage). B: diagnose the overload hazard.
C: change the visibility rule (spec call; overlaps RFCs #12972/#12973). D: docs line on `__exported import`.

**Disposition.** Fixer HELD by the triager: accepting a new diagnostic note is a maintainer call. Main asked the operator on
`orchestrator-dashboard` (10-14): (1) go on A as a draft PR now, or wait for a maintainer; (2) file the overload hazard?
**Resume:** an operator "go" → tell slang-triager on this thread to hand off A to slang-fixer, never dispatching the fixer
directly ([[feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer]]). A maintainer or reporter comment → slang-triager.
One-shot re-check `recheck-13627-import-hin-bf8f` on 10-21T20:45Z.
