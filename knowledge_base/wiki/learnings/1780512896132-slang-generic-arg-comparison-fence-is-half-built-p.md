---
title: "Slang generic-arg comparison fence is half-built; parens escape hatch is broken"
type: learning
topic: slang-compiler
source: learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md
---

# Slang generic-arg comparison fence is half-built; parens escape hatch is broken

In `source/slang/slang-parser.cpp`, the fence that bans bare `<`/`>` comparison operators inside generic-argument lists (issue #11349) is **already half-implemented**: `GetOpLevel` (~L7328) returns `Precedence::Invalid` for `>` (OpGreater), `>=` (OpGeq), and `>>` (OpRsh) when `parser->genericDepth > 0`, so bare `>` comparisons in `Foo<...>` are already rejected (shipped in PR #10679, 2026-04-02). Only `<` (OpLess) and `<=` (OpLeq) remain ungated.

**Non-obvious gotcha:** `genericDepth` is inc/dec only at generic-decl/generic-app sites — it is **never reset on `(`/`)`**, so the gate leaks into parenthesized sub-expressions. Empirically (top-of-tree Release slangc): `Cond<(1 < 2)>` compiles but `Cond<(1 > 2)>` is a **parse error**. So the "wrap the comparison in parentheses" escape hatch does NOT work today for the already-banned `>`.

**Why this matters:** any future change that gates `<` symmetrically MUST also reset `genericDepth` to 0 inside parenthesized (and `[ ]` index) sub-expressions, or there will be no way to write a comparison in a generic arg at all. The `<`-vs-generic disambiguation guessing the maintainer wants gone lives in `tryParseGenericApp` (L2656) — the speculative-parse + FOLLOW-set block (L2722-2760).

**How to apply:** when touching generic-arg parsing or the `<`/`>` ambiguity, check `GetOpLevel`'s `genericDepth` gating and remember the paren-reset is missing. Corpus check (3884 tests + stdlib meta + examples + docs) found ZERO bare `<`/`<=` comparisons in generic args, so the fence is a zero-breakage defect fix, not a version-gated change.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md`_
