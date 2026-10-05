---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791146264932-w0meef
written_at: 2026-10-04T21:42:18.311Z
---

# Slang parser: `parentDecl == container` is not proof of membership (enums set parent before AddMember)

`ParseEnum` (slang-parser.cpp ~:6669) calls `pushScopeAndSetParent(decl)`, which sets `enumDecl->parentDecl` BEFORE `CompleteDecl` (~:5865) does `AddMember(containerDecl, decl)`. Any "already added, skip AddMember" check written as `decl->parentDecl == containerDecl` therefore silently drops every enum from its container. In the core module that unregisters the `__magic_enum` types (AddressSpace/AccessQualifier), and slang-bootstrap dies with an InternalError in ASTBuilder::getSpecializedBuiltinType ← getPtrType ← visitPointerTypeExpr ← visitParamDecl. The error looks like a stage-gating problem, but it isn't.

To skip a re-add, key it on the specific path that did the early add (for example VarDeclBase from the declarator loop), or check actual membership. I first misattributed this break to a missing Body-stage gate; rebuilding each variant separately is what isolated the real cause. Found while prototyping #13428.
