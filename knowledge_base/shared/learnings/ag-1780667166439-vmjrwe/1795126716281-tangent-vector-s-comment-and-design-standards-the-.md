---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040985190-v53hrm
written_at: 2026-11-19T22:18:36.282Z
---

# tangent-vector's comment and design standards: the full checklist from slang PR #14627

tangent-vector's full style/code standards, stated with force across six review rounds on slang PR #14627 (2026-11-19) — the durable checklist for every future change:

COMMENT CODE:
1. Operation doc comments = one line of responsibility ("Parse a condition clause."). Never per-case walkthroughs, never implementation mechanics, never rationale essays (a comment justifying ugly code is a signal the abstraction is wrong).
2. The doc comment lives on the DECLARATION; the definition carries none (its prose, if load-bearing, moves inside the body as short inline notes).
3. No agency for non-actors: languages/dialects don't reject anything — the parser/compiler rejects X "when parsing the Slang language or the GLSL dialect". Ascribing action to pure concepts is "a hallmark of slop agentic writing".
4. No imperatives anywhere: comments address a respected colleague about how the system is implemented and why ("the parser restores the language version"), never instruct the reader.
5. Type comments must not enumerate clients or per-statement forms — if a change in a CLIENT could rot the comment, the comment is bad (dependency inversion). Client-facing entry points (getPredicateExpr, ConditionClauseVisitor) ARE good to mention. When `guard` statements arrive, the existing comments must stay correct untouched.
6. Don't invent terminology: "condition variable" already means something else; say "a variable declaration used as a condition". Brevity is never a license for fake terms.

DESIGN CODE:
7. Base classes hold no field that is null-except-for-one-subclass; and "C++ does it" is NEVER a valid motivation for a prohibition, on its own — the default is: if `<modifiers> T x = e; stmt(x)` is valid, then the form with the declaration in the condition is valid. Remove rejection logic that exists only for cross-language parity.
8. Statements own their condition scopes: push/pop unconditionally around each if/while/do-while condition (if-let keeps its one-off scoping). This WORKS — the "core module breaks" was actually three unbraced `else`-arm map-macro invocations in hlsl.meta.slang (firstbithigh/firstbitlow/reversebits) relying on unbraced-arm declarations leaking into the enclosing scope; brace them and the design holds. Lowering reads the condition's ScopeDecl from the declaration's parentDecl.
9. Unknown cases assert (SLANG_UNEXPECTED), never silently return null — a future subclass must fail loudly at every dispatch point. The generated per-subclass visitor defaults fall back to visitConditionClause, so that method must exist — make it assert.
10. Prefer making the main visitor (e.g. SemanticsStmtVisitor) derive from the new per-hierarchy visitor over nested local visitor structs. Out-of-line definitions in .cpp over inline header definitions for non-trivial functions.
11. User-facing diagnostic text: state what the user needs to know, name the specific offender, never reference other languages/dialects, never steer toward another dialect ("use a .hlsl file" is OUT); simple single-sentence messages.

PROCESS: when a maintainer design suggestion appears to break the build, root-cause it before reporting failure — my "deferred-parse contamination" was wrong and one grep (else VECTOR_MAP) would have found the truth. He pushed back on my revert and was right.
