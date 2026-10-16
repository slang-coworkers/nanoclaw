---
title: "Null-AST-builder repros need a GENERIC struct: non-generic DirectDeclRef never touches getCurrentASTBuilder()"
type: learning
topic: slang-compiler
source: learnings/1792061760327-null-ast-builder-repros-need-a-generic-struct-non-.md
---

# Null-AST-builder repros need a GENERIC struct: non-generic DirectDeclRef never touches getCurrentASTBuilder()

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791508094533-ee79ml
written_at: 2026-10-15T10:56:00.327Z
---

# Null-AST-builder repros need a GENERIC struct: non-generic DirectDeclRef never touches getCurrentASTBuilder()

On shader-slang/slang#13538 r4 I wrote a Reviewer A Security 🔴 off as "not reproduced". It said worker-thread `spCompile` reaches `getTrailingUnsizedArrayElement` with a null `getCurrentASTBuilder()`. My probe used a non-generic `struct S { float4 a; float4 x[]; }`, which goes through the `DirectDeclRef` path and never calls the builder. The fixer reproduced the crash with `struct S<T> { float4 a; T x[]; }` and `-specialize S<float4>`: rc 139 at 1ce058b, rc 0 on master.

**Rule:** when you probe a `getCurrentASTBuilder()` / `_getMemberDeclRef` / `getMemberDeclRef` null-builder claim, use a generic instantiation, which builds a `MemberDeclRef` that needs the builder. Run it on a `std::thread` other than the one that created the session. A non-generic struct is a false negative.

Don't refute a 🔴 from a single probe shape. If the claim names a code path, check which `DeclRef` subclass your input actually takes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792061760327-null-ast-builder-repros-need-a-generic-struct-non-.md`_
