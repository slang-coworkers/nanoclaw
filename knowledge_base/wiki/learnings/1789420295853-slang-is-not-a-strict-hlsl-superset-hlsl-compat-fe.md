---
title: "Slang is NOT a strict HLSL superset — HLSL-compat features gate to the HLSL dialect, not main Slang"
type: learning
topic: slang-compiler
source: learnings/1789420295853-slang-is-not-a-strict-hlsl-superset-hlsl-compat-fe.md
---

# Slang is NOT a strict HLSL superset — HLSL-compat features gate to the HLSL dialect, not main Slang

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789416153147-zs71i5
written_at: 2026-09-14T21:11:35.853Z
---

# Slang is NOT a strict HLSL superset — HLSL-compat features gate to the HLSL dialect, not main Slang

When triaging an HLSL-compatibility feature request (accept a C/HLSL spelling the main Slang dialect rejects), do NOT assume "Slang is an HLSL superset, so accept it in Slang mode too." Maintainer **tangent-vector** stated authoritatively (shader-slang/slang#13076, cmt 5670796267, 2026-09-14): *"Slang is not strictly an HLSL superset. It aspires to accept a large fraction of pre-existing HLSL code as-is, while not promising true compatibility in the general case. It is okay for the HLSL-flavored dialect the Slang compiler supports to have compatibility behaviors/features that 'proper' Slang does not."*

Consequences for triage:
- The source-language gate is a **real design decision**, and the principled default is **HLSL-flavored-dialect-ONLY**, not main Slang. This retires the "but it soft-reserves a currently-legal Slang identifier" worry entirely (dialect-gated).
- Watch the trap: a reporter files "accept X for HLSL input" but their repro is a `.slang` file (`SourceLanguage::Slang`, not HLSL). Under dialect-only gating, the fix accepts X only when compiled in the HLSL dialect (`-lang hlsl` / `.hlsl`) — deliberate, and the reporter's exact `.slang` repro is NOT accepted in main Slang. Surface this gating question in triage; it's load-bearing.

Design pattern the maintainer blessed for accepting a new C-style type spelling (e.g. `unsigned int`→uint): dispatch from `_parseSimpleTypeSpec` on lookahead of the keyword to a dedicated helper that returns a **new AST type-expression node class** (with a signedness/kind enum), resolved to the builtin type during semantic checking — NOT a "fake parsed identifier" (synthesizing a `VarExpr("uint")`), which he explicitly rejected. Matches the codebase's no-semantic-to-syntax-reconstruction / one-canonical-representation methodology.

Also: `unsigned` and `signed` are currently legal identifiers in main Slang (`int unsigned = 5;` and a struct field named `signed` compile clean on top-of-tree) — verify before claiming any spelling is reserved.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789420295853-slang-is-not-a-strict-hlsl-superset-hlsl-compat-fe.md`_
