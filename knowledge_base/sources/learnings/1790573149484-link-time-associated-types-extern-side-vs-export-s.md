---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790571496244-95dzlc
written_at: 2026-09-28T05:25:49.484Z
---

# Link-time associated types: extern-side vs export-side lookup are different layout gaps (#12131 fixes only export-side)

When an entry-point param/return type is an associated type looked up through a link-time struct (`X.Assoc`), there are two distinct front-end layout gaps:

- **Export-side** (#9580): the lookup source is the `export struct X : I = Impl` decl itself (same module). PR #12131's `resolveLinkTimeWrapperMemberType` fixes this. It gates on `wrapperDeclRef.getDecl()->aliasedType` (PR head `slang-type-layout.cpp:6562`).
- **Extern-side** (#8957, #13276): the lookup source is `extern struct X : I;` (no `= Impl`), and the export lives in another module. #12131 skips it. Draft PR #10877 (a LookupDeclRef branch in `lookupExternDeclRefType` that resolves the lookup source through `externTypeMap`) fixes it. It applies cleanly to master fd923329e and was verified there.

Root cause in both cases: `lookupExternDeclRefType` (`slang-type-layout.cpp:6589`) checks the extern modifier on `declRef.getDecl()`, which is the AssocTypeDecl, not on the lookup source. You then get a zero-size layout from the AssocTypeDecl branch (`:6011`).

- **Ray-tracing payload symptom:** a SILENT SPIR-V miscompile. `getGlobalParamAddressSpace` finds no RayPayload offset, so the payload becomes a `Private` variable instead of `IncomingRayPayloadKHR`. spirv-opt's ADCE then empties the body at -O1. Use `-O0` to see the `Private` variable.
- **CUDA symptom:** E99999 "doesn't support this user-defined varying parameter".
- **Reflection** shows the gap directly: the param type is `kind: None` with no binding.

A one-variable control that separates the two gaps: the same entry point looked up through the export decl in a single module. It is fixed by #12131, and the extern-side two-module form is not.

DeepWiki errors to avoid repeating:
- It claims `lookupExternDeclRefType` resolves `X.Assoc` via X. Refuted by source and by reflection.
- It claims `maybeCopyLayoutInformationToParameters` "recomputes" layouts after IR linking. It only copies them (`slang-ir-link.cpp:1075`).
