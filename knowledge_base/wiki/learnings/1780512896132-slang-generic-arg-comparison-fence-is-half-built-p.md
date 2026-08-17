---
title: "Slang generic-arg comparison fence is half-built; parens escape hatch is broken"
type: learning
topic: slang-compiler
source: learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md
---

# Slang generic-arg comparison fence is half-built; parens escape hatch is broken

In `source/slang/slang-parser.cpp`, the fence that bans bare `<`/`>` comparison operators inside generic-argument lists (issue #11349) is **already half-implemented**: `GetOpLevel` (**:7791-7803** @ HEAD `0864e60e6`) returns `Precedence::Invalid` for `>` (OpGreater), `>=` (OpGeq), and `>>` (OpRsh) when `parser->genericDepth > 0`, so bare `>` comparisons in `Foo<...>` are already rejected. Only `<` (OpLess) and `<=` (OpLeq) remain ungated.

**Provenance — this is NOT a recent fence.** Both gate sites, with the same comments ("Don't allow these ops inside a generic argument"), are present in the **2017 initial import**: `git show fcf83dbf9:source/slang/parser.cpp` (historical filename `parser.cpp`, not `slang-parser.cpp`), and at `v0.5.3` and `v2024.0.0`. *Corrected 2026-08-04: an earlier version of this note said "shipped in PR #10679, 2026-04-02" — that was wrong in kind, not just in digits. #10679 is "Reject pointer fields in dynamic dispatch for SPIRV" (jvepsalainen-nv), unrelated to the parser.* **Scope limit:** the import shows the gate *exists*; its commit message does not say *why*, so "has existed since 2017" is established while "was introduced deliberately for reason X" is NOT — don't upgrade the former into the latter.

**Non-obvious gotcha (CONFIRMED @ HEAD `0864e60e6`, and wider than first recorded):** `genericDepth` (`int`, :132) is inc/dec at only 3 balanced pairs (:1741/:1771, :2886/:2905, :6143/:6147) — it is **never reset when entering a balanced sub-expression**, so the gate leaks inside one. This hits **all three gated tokens, not just `>`**, and **every balanced delimiter, not just grouping parens**: `Cond<(1 > 2)>`, `Cond<(1 >= 2)>`, `Cond<(4 >> 1)>`, call-arg `Cond<id(1 > 2)>` (:9144) and subscript `Cond<a[(1 > 2)]>` (:9117) are all parse errors, while every `<` mirror (`(1 < 2)`, `(1 <= 2)`, `(4 << 1)`) compiles. So the "wrap the comparison in parentheses" escape hatch does NOT work today. The underlying model defect: `genericDepth` conflates *"lexically inside a generic arg list"* with *"a `>` at this nesting level could close it"*.

**Why this matters:** any future change that gates `<` symmetrically MUST also suspend `genericDepth` inside balanced sub-expressions, or there will be no way to write a comparison in a generic arg at all. Two MEMBERs on **#11349** (juliusikkala; skiminki-nv: *"we should simply reject non-parenthesized less and greater comparison operators … more or less a required concession"*) want the fence **completed** for `<` too, and their proposal **presupposes parenthesization as the sanctioned escape hatch** — so the paren leak is a prerequisite for #11349, not a side-issue, and it is *not* design-gated in either direction. Contrast **#9866**, which wants the opposite outcome (bare `>` *supported*) and IS a genuine maintainer design call. The `<`-vs-generic disambiguation the maintainer wants gone lives in `tryParseGenericApp` (:2942) — speculative parse :3020 + FOLLOW-set commit :3025-3045.

**Fix constraints:** `Parser(const Parser&) = default` (**:188**) means a sub-parser *copies* `genericDepth` rather than resetting it, so the speculative path inherits the gate. Prefer a scoped `SLANG_DEFER`/RAII suspension around the paren-expression parse (`TokenType::LParent` :8800-8811, `ParenExpr` :8934) over hand save/restore — the existing inc/dec sites are manual and not early-return safe. Do **not** leave it suspended across the cast operand at :8928 (that operand sits outside the cast's own `(type)` delimiters). Take care with `>>`: `parseGenericApp` mutates the `OpRsh` token **in place** (:2907-2912).

**How to apply:** when touching generic-arg parsing or the `<`/`>` ambiguity, check `GetOpLevel`'s `genericDepth` gating and remember the paren-reset is missing. Corpus check (3884 tests + stdlib meta + examples + docs) found ZERO bare `<`/`<=` comparisons in generic args, so the fence is a zero-breakage defect fix, not a version-gated change.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md`_
