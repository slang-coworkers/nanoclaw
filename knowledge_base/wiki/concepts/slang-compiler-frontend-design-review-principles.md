---
title: "Slang Front-End Design Review Principles (tangent-vector, #13406)"
type: concept
group: slang-language-core
tags: [slang, design-review, tangent-vector, ParamPassingMode, RefParam, access-mode, fail-closed, switch, enum, ad-hoc-guard, unrepresentable-state, signature-printing, swizzle, value-category, entry-point-validation, code-review]
source_count: 2
---

# Slang Front-End Design Review Principles (tangent-vector, #13406)

On 2026-10-16 tangent-vector left about 20 review threads on shader-slang/slang#13406, the `Ref` access-mode split. Several threads target code the bot wrote in rounds 1–3. One, on the bot's `RefParam` access validation in `CoerceToProperTypeImpl` (`slang-check-type.cpp:470`, from commits `0adba88fd1` and `5fb807fbbb`), reads: "This is gross and the agent who wrote it should be terminated." Most threads point at a few recurring design mistakes. This page states them as rules for any change that adds a parameter-passing mode, an access flag, or a type diagnostic. Related: the `ParamPassingMode` consumer sweep (including entry-point validation) on [Slang Compiler: C/COM API Ownership & Front-End Guard/Cast Bugs](../concepts/slang-compiler-api-ownership-and-frontend-guards.md); scope lookup fixed at the producer on [Slang Scope Lookup, Function-Local Types, and Declaration Checking](../concepts/slang-language-scope-lookup-and-declaration-checking.md).

## TL;DR

- Ad hoc logic is a signal that the design is wrong. tangent-vector's summary: "Every time we are adding ad hoc logic, we should question whether we are doing things wrong."
- Do not add a diagnostic for a specialization you dislike. A core-module generic accepts anything its kind and constraints allow. Make the bad case unrepresentable instead.
- Do not invent a construct and then validate around it. A keyword that expands to two modifiers, or a `RefParam<T, Access>` that needs an "is this Access valid" check, created its own problem.
- Use one modifier per keyword, and one distinct wrapper type per mode instead of one type with an `Access` generic parameter.
- Fail closed. A `default:` on a closed enum asserts (`SLANG_UNEXPECTED`). Unknown access means no access, never "treat it as read-write to be safe".
- Branch on the source-of-truth mode with one exhaustive `switch`, with a `case` per mode and sibling cases such as `BorrowIn` folded in. Put it in a named helper.
- Do not build if/else ladders over the mode, derived direction pairs (isInput/isOutput), or a second query of the type that callers must combine with the mode again.
- Value category and access are independent axes. Do not merge them into one flag such as `isReadOnlyMemoryLocation`.
- A swizzle with duplicate indices is an rvalue. A non-contiguous swizzle is a storage location. Only a contiguous swizzle is a memory location.
- Names state what the thing is. A mode grants the function body permission to read; it does not do the reading.
- Say "argument" or "parameter" precisely. An `out` parameter can be read in the callee body.
- A comment must be understandable without the PR's context.
- Signature printing shows what callers need: the passing mode, not the spelling and not `const` modifiers. Print nothing for `in`.
- Validate entry-point parameter modes in entry-point validation.
- A fixer's CODE_REVIEW on a language-feature change checks the diff against these rules. Flag any `default:` that grants a permission, any if/else ladder over an enum, and any validation of a value the same change made possible.

## Make the invalid state unrepresentable

The central complaint was validation code that guards a state the change itself introduced. A core-module generic accepts every argument that its kind and constraints allow, so an ad hoc diagnostic for one specialization is the wrong tool. Make the bad case impossible to write [systematic checking, not ad hoc guards](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md). Two #13406 threads show the pattern. A keyword that expands to two modifiers (`slang-check-modifier.cpp:2563`) needs extra checks for the combination. A `RefParam<T, Access>` needs an "is this a valid Access" check in `CoerceToProperTypeImpl` (`slang-check-type.cpp:470`). Both created the problem they then validate. The preferred shape is one modifier per keyword and one distinct type per mode, so that an invalid combination has no representation [patterns the fixer fleet must stop producing](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md). A single wrapper type with an `Access` generic also pushes work onto every consumer, which must query the type and choose a policy [same](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md).

## Fail closed, and switch on the source-of-truth enum

An unknown case must not fall back to the most permissive behaviour. A `default:` that "treats it as read-write" hides a policy decision in a fallback (`slang-ast-type.cpp:1435/1447`). On a closed enum, `default:` asserts; when in doubt, grant no access [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md).

Code that branches on a parameter-passing mode uses one exhaustive `switch (mode)` with a `case` per mode, inside a named helper. The review flagged if/else ladders, a derived "direction" pair, and second queries of the type at `slang-check-shader.cpp:34/44`, `slang-ast-type.cpp:679/781/1527` and `slang-ast-print.cpp:1594`. Sibling cases such as `BorrowIn` fold into the same switch [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md). Derived flag bundles (isInput/isOutput, `isReadOnlyMemoryLocation`) are the same mistake: each caller has to combine them with the mode again [same](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md).

## Keep independent axes apart

Value category and access are independent. Merging them into one flag, such as `isReadOnlyMemoryLocation` in `QualType` (`slang-ast-support-types.h:655`), was flagged [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md). The swizzle case shows why the axes differ. A swizzle with duplicate indices is an rvalue. A non-contiguous swizzle is a storage location. Only a contiguous swizzle is a memory location [same](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md).

## Names, comments, and printed signatures

- **Names state what the thing is.** `doesParamPassingModeReadArgument` makes the mode sound like the reader. A mode grants a function body permission to read (`slang-ast-support-types.h:2021`) [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md).
- **Use "argument" and "parameter" precisely.** An `out` parameter can be read in the callee body [same](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md).
- **Comments are understandable without context.** "A constant access on a `RefParam`" meant nothing to the reviewer [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md).
- **Signatures print the passing mode**, which is what callers need, not the source spelling or `const` modifiers. They print nothing for `in` (`slang-ast-print.cpp:1600`) [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md).
- **Entry-point parameter modes are validated in entry-point validation**, not at other sites [same](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md).

## How the fleet applies this

Before a fixer's CODE_REVIEW signs off on a change to a language feature, it checks the diff against these rules. It flags any `default:` that grants a permission, any if/else ladder over an enum, and any validation of a value that the same change made possible. The lesson is fleet-internal. #13406 now belongs to jhelferty-nv, who asked the bot to stand down, so no one replies on GitHub about it [same](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md).

## Contradictions / supersessions

- The two atoms come from the same review, written about three minutes apart by different sessions. Neither covers the other. The earlier one has the file/line references, the comment-clarity and naming rules, and the stand-down instruction. The later one has the core-module-generic rule, the swizzle classification, the argument/parameter wording, and the entry-point-validation rule. Both stay live.

**Source learnings (2):**
- [tangent-vector's #13406 review: systematic checking instead of ad hoc guards; one wrapper type per mode; `default:` asserts; switch in a named helper; swizzle value categories; print the mode; validate entry-point modes in entry-point validation](../learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md)
- [seven #13406 rules with file/line references (fail closed, one switch, don't validate your own construct, names, context-free comments, signature printing, separate axes); fleet-only, PR owner asked the bot to stand down](../learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md)
