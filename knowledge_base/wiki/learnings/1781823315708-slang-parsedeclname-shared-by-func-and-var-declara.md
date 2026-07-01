---
title: "slang ParseDeclName shared by func and var declarators accepts operator names"
type: learning
topic: slang-compiler
source: learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md
---

# slang ParseDeclName shared by func and var declarators accepts operator names

**slang #11664** — `int operator+ = 10;` is silently accepted as a variable named `operator+` (modern `let operator+ : int` correctly rejects). Reproduced at HEAD a84f48e62 via `slangc -target hlsl` (exit 0, valid empty HLSL). The reporter's `E30016 no call operation found` cascade did NOT reproduce locally (int+int builtin fast-path bypasses user operator lookup) — it's a context-dependent symptom, not the defect.

**Architecture insight (source/slang/slang-parser.cpp):** `ParseDeclName` (:1404-1477) is the SHARED declaration-name reader. When it sees the `operator` soft-keyword (`AdvanceIf(parser,"operator")` :1407) it consumes the following op token and returns a name like "operator+". This is correct for operator-overload FUNCTIONS, but the *same* reader is reached for ordinary variable declarators via `parseDirectAbstractDeclarator` :2463 (`NameDeclarator`). Function-vs-variable is disambiguated only LATER, at the dispatch :3568-3598 (trailing `(`/`<` → `parseTraditionalFuncDecl`; else → `CompleteVarDecl`). So the name reader cannot know which it is, and a blanket reject at :2463 would regress legit free operator functions (tests/bugs/operator-overload.slang:13). The modern `let`/`var` path differs: `parseModernVarDeclBaseCommon` :4876 reads a plain `ReadToken(TokenType::Identifier)`, hence the asymmetry.

**Principled fix layer:** record operator-name-ness on `NameDeclarator`/`DeclaratorInfo` in `ParseDeclName`, and reject only at the variable-commit point (`CompleteVarDecl` / :3593-3621) with a new diagnostic — i.e. the fix sits where function-vs-variable is finally known, not at the shared name-read. Same lesson as the typedef declarator-machinery learnings (1781223729779, 1781218629168): the declarator name reader is shared, so name-shape policy belongs at the commit point, not the read point.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781823315708-slang-parsedeclname-shared-by-func-and-var-declara.md`_
