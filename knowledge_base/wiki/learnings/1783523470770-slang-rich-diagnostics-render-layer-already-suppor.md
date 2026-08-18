---
title: "slang rich-diagnostics render layer already supports SourceRange; only authoring/plumbing collapses to one loc"
type: learning
topic: slang-compiler
source: learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md
---

# slang rich-diagnostics render layer already supports SourceRange; only authoring/plumbing collapses to one loc

Triaging slang#10476 (request to underline source-location RANGES in diagnostics, not just single carets). Non-obvious, verified @ origin/master bfe6a7f14 — useful for any diagnostics-span triage:

**The render layer and span data model ALREADY support ranges end-to-end. Do NOT scope a range-underline feature as a rendering change.**
- `DiagnosticSpan` is `{ SourceRange range; String message; }` — `source/compiler-core/slang-rich-diagnostics-render.h:13`. The span is a RANGE, not a loc.
- `makeLayoutSpan` (`slang-rich-diagnostics-render.cpp:759`): length = `span.range.begin == span.range.end ? -1 : span.range.getOffset(span.range.end)`. begin==end → `-1` triggers the "lex one token" single-caret fallback (`:432`, `length<=0` → `m_lexer(...).getLength()`). begin!=end → the FULL RANGE is underlined already. Machine-readable path (`:911-921`) also reads begin/end distinctly.

**The gap is entirely the AUTHORING/PLUMBING layer** (where a range is flattened to zero-width):
- DSL: `getLocationExpr` (`source/slang/slang-rich-diagnostics.h.lua:97-155`) maps every typed location to ONE SourceLoc (`expr/stmt/type/val/name/modifier → ->loc`, `irinst → ->sourceLoc`, `decl → getDiagnosticPos`). No begin/end pair. The `span { loc = "name[:Type]" }` DSL form exposes a single loc only.
- Codegen: `slang-rich-diagnostics.cpp:333` (and 337/364/378/409/423/455/469) emit `result.primarySpan.range = SourceRange{<single loc>}` → single-arg ctor makes begin==end. THIS is the choke point.
- Legacy fallback `diagnoseRichImpl(SourceLoc,...)` also does `SourceRange{loc}` (`slang-diagnostic-sink.cpp:719`) — old path, leave it.

**So the reporter's ask (1) — span accepts a SourceRange/begin+end — is a small ADDITIVE DSL+codegen change (renderer untouched). Asks (2) AST nodes store SourceRange (`slang-ast-base.h:138`, ~668 `->loc` sites) and (3) IR insts store SourceRange (`slang-ir.h:562`, ~313 sites + IR serialization in slang-serialize-source-loc.h) are large cross-cutting representation changes — split into separate maintainer-designed follow-ups.** Multiline spans: renderer is already per-line (buildSectionLayout); a long range just needs a line-cap/elision policy (orthogonal render follow-up).

Also: `send_message` MCP tool does NOT resolve the alias `parent` ("No agent named 'parent' is currently addressable"); use the `<message to="parent">` block form for edge routing instead (the tool wants an agent ID/real name).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783523470770-slang-rich-diagnostics-render-layer-already-suppor.md`_
