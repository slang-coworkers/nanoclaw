---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790018369077-990oln
written_at: 2026-09-22T20:02:10.312Z
---

# Slang parser: decl-vs-statement can't be disambiguated lexically; needs a side-effect-free declaration probe

From the #13208 design investigation (parser: accept-then-diagnose statements in declaration-only contexts). All refs source/slang/slang-parser.cpp @ HEAD 0d06f4bd0; counterexamples compiled with checked-in Debug slangc.

**A lexical rule for "is this a statement vs a declaration" is UNSOUND in Slang.** Neither "identifier immediately followed by `(`" nor "leading statement keyword" is safe evidence — all of these are valid *declarations* at file/struct scope:
- `float(x);` — variable decl via a **parenthesized declarator** (`_parseSimpleTypeSpec`:3526 → `parseDirectAbstractDeclarator`:2606, declarator paren :3804).
- `__init(...)` / `__subscript(...)` — declaration syntax beginning `ident(` (registered :10845/:10846).
- `syntax ctor = __init;` then `ctor(...)` — user syntax alias (:5327), consulted before the declarator fallback (:5942).
- `struct if {}; if(x);` — keywords are **contextual/shadowable** (:2539), so a leading `if`/`for`/… is not reserved.
⇒ Disambiguation must be a genuine **declaration parse attempt**, not a token pattern.

**"Build the decl but don't add it" is NOT non-committing.** Declaration parsing mutates shared state well before `CompleteDecl` adds to the container (`AddMember` :5863): namespaces `AddMember` :4642, buffer parsing adds a scope member :4303, modifier parsing can bump the module language version :1274. A speculative decl probe must be either a truly side-effect-free *recognizer* or a parse whose *entire* pre-completion mutation set (container/scope-stack/module-state) is transactionally rolled back. The existing speculative cursor-snapshot sites (:3057/:8525, getCursor/setCursor) only ever parse **expressions**, not declarations.

**Architecture map:** two-stage parse — `ParsingStage::Decl` (:10122) parses file scope + aggregate bodies eagerly; function bodies captured as `UnparsedStmt` (`parseOptBody`:2261) and re-parsed on demand in `ParsingStage::Body` via `SemanticsVisitor::maybeParseStmt` (slang-check-decl.cpp:15091) — so semantic-state disambiguation only exists in the Body stage. `parseDecls`(:6322)→`ParseDecl`(:6085)→`ParseDeclWithModifiers`(:5911) is the shared declaration-only loop (file :6459 + brace bodies via `parseDeclBody`:6390); `MatchedTokenType` (:293) is delimiter/recovery info, not a decl-context policy. Function-body statement parsing is a SEPARATE loop (`ParseStatement`:7029 cursor-snapshot guess-then-commit :7185 → `parseVarDeclrStatement`:7362; `parseBlockStatement`:7255 special-cases struct/typedef/typealias). `ParseStatement` has no decl-only-vs-decl-or-statement flag — that's the seam any "declaration-or-statement(context)" refactor introduces. Standing TODOs (:7136-7142 "look up the SyntaxDecl first", :7161-7166 "intermix with semantic checking") anticipate the principled version.

**Accept-then-diagnose precedent is Decl-only:** `CompleteDecl`:5821 → `DeclNotAllowed`:5824; the richer `DeclNotAllowedInContext` (diag :4112) is emitted later by the checker's `validateDeclNesting` (slang-check-decl.cpp:304), with `nestingAlreadyDiagnosed` (a `Decl` field, slang-ast-base.h:805) suppressing the dup. For a statement-in-decl-context, the mirrorable (not literally reusable) inverse precedent is `parseVarDeclrStatement`:7362. `UnparsedStmt` is Stmt-only (slang-ast-stmt.h:53); there is no Stmt-carrying-Decl node.
