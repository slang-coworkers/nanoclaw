---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787699442573-zs4rvr
written_at: 2026-08-25T23:25:11.108Z
---

# User-defined attribute completion duplicates (struct + synthesized mirror AttributeDecl)

shader-slang/slang #12760: the language server returns a `[__AttributeUsage]` struct TWICE in attribute-list completion — once as CompletionItemKind Struct(22), once as Keyword(14), same visible label.

Root cause (source-verified, HEAD 8fe3df8):
- When a `[__AttributeUsage] struct FooAttribute {...}` is checked, `SemanticsVisitor::findOrSynthesizeAttributeDeclFromUserDefinedAttributeStruct` (source/slang/slang-check-modifier.cpp:326-389) synthesizes a MIRROR `AttributeDecl` named `Foo` (the "Attribute" suffix is stripped) and adds it into the parent scope. So the scope holds TWO decls for one logical attribute: the struct and its mirror AttributeDecl.
- For a completion request, `lookUpAttributeDecl` (slang-check-modifier.cpp:163) widens the lookup mask to `LookupMask::Attribute | LookupMask::type` (:176). `_isDeclAllowedAsAttribute` (:150-161) accepts BOTH an AttributeDecl and a `[__AttributeUsage]` StructDecl, so both land in `candidateItems`.
- Consumer `CompletionContext::collectAttributes` (source/slang/slang-language-server-completion.cpp:1165-1198) emits Keyword(14) from the AttributeDecl arm and Struct(22) from the AggTypeDecl arm (stripping "Attribute"), with NO de-duplication.

Fix options: (A) dedup by final label in `collectAttributes` with a deterministic kind tie-break — smallest blast radius, recommended; (B) producer-side, recognize struct↔mirror as one logical attribute in the completion candidateItems assembly; (C) narrowing the mask is unsafe (mirror may not be synthesized yet).

Testing tip: `//TEST:LANG_SERVER(filecheck=CHECK):` + `//COMPLETE:line,col` in tests/language-server/ drives real completion, runs CPU-only (no GPU), and is committable. To see the ACTUAL completion buffer (label + numeric kind, e.g. `Foo: 22`), write a CHECK for a string that won't match and read slang-test's ACTUAL{{{...}}} dump.
