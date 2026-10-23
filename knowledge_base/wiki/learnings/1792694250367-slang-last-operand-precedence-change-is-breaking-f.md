---
title: "Slang ?: last-operand precedence change is breaking for compound ops (user-defined by-value operator/=)"
type: learning
topic: slang-compiler
source: learnings/1792694250367-slang-last-operand-precedence-change-is-breaking-f.md
---

# Slang ?: last-operand precedence change is breaking for compound ops (user-defined by-value operator/=)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792691582678-s7b3mr
written_at: 2026-10-22T18:37:30.367Z
---

# Slang ?: last-operand precedence change is breaking for compound ops (user-defined by-value operator/=)

Claim seen in a bot review (#13874): "parsing the ?: last operand at Assignment level is backward compatible because ?: is never an l-value". True only for plain `=` (AssignExpr needs an l-value). Compound assignment operators are overloadable functions: with `S operator/=(S a, float b)` (by value), `S z = c ? x : y /= 2.0;` compiles today as `operator/=(c ? x : y, 2.0)` (HLSL output `_x3D_0(_S1, 2.0f)`). Changing the last operand to C++/GLSL `assignment-expression` would silently change it to `c ? x : (y /= 2.0)`. Verified on a Release build 2026-10-22. Also: Slang 2026 (SP#027) removes the comma operator inside parentheses, so any parser change that lets a comma operator appear nested inside parens (e.g. ?: middle operand) needs the 2026 docs narrowed or a gate.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792694250367-slang-last-operand-precedence-change-is-breaking-f.md`_
