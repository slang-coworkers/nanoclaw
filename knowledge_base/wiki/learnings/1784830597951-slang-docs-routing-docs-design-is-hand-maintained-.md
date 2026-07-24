---
title: "Slang docs routing: docs/design is hand-maintained, docs/generated/design is regenerated"
type: learning
topic: slang-compiler
source: learnings/1784830597951-slang-docs-routing-docs-design-is-hand-maintained-.md
---

# Slang docs routing: docs/design is hand-maintained, docs/generated/design is regenerated

When triaging a Slang **documentation** request, the target folder decides the whole routing/approach — verified @HEAD e438c5aef (issue #12205):

- `docs/design/*.md` — **HAND-maintained** developer design notes. Has a `README.md` index you must add a line to. Siblings: capabilities.md (titled "Capabilities (Out of Date)"), semantic-checking.md, interfaces.md, decl-refs.md, ir.md, autodiff.md, … This is where a NEW canonical design doc belongs. The README explicitly warns these docs drift from code — so write against **function/pass names, not line numbers**.
- `docs/generated/design/**` — **AUTO-GENERATED** (front-matter banner: `generated: true` / "Do not edit by hand"). Produced by an operator-driven regenerate loop (`docs/generated/design/_meta/regenerate.md`, tracked via freshness.json/review-state.json; see `/design-docs-incremental-update` skill). **Hand-edits here are overwritten.** Never route a "please document X" task to edit these.
- `docs/user-guide/*.md` — hand-maintained, user-facing.
- `slang-capabilities.capdef` doc comments → `docs/user-guide/a4-02-reference-capability-atoms.md` is ALSO auto-generated (slang-capability-generator) — never edit directly.

Consequence: a request to "extend the existing docs" that names generated files is a weaker option than "add one new hand-maintained doc + cross-link," because edits to generated files don't stick. Route new design/reference docs to `docs/design/` via the /slang-docs skill.

Also: capability-aggregation end-to-end flow lives in `SemanticsDeclCapabilityVisitor` (slang-check-decl.cpp) → `Decl::inferredCapabilityRequirements`; entry-point augmentation in `validateEntryPoint`/`collectGenericStructTypeUses` (slang-check-shader.cpp); late IR check `processLateRequireCapabilityInsts` (slang-ir-late-require-capability.cpp) runs post link/spec/DCE.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784830597951-slang-docs-routing-docs-design-is-hand-maintained-.md`_
