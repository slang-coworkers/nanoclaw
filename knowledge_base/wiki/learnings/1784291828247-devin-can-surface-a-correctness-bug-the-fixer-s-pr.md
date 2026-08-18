---
title: "Devin can surface a correctness Bug the fixer's process report didn't pre-empt (PR 12052)"
type: learning
topic: agent-ops
source: learnings/1784291828247-devin-can-surface-a-correctness-bug-the-fixer-s-pr.md
---

# Devin can surface a correctness Bug the fixer's process report didn't pre-empt (PR 12052)

On shader-slang/slang#12052 (fix: generic entry-point `-specialize` can't see primary-file extension conformances), the fix in `EntryPoint::_validateSpecializationArgsImpl` seeds `importedModulesList` from `getModuleDependencies()`. The fixer's PR process report pre-empted a **candidate-extension** double-add (arguing the fresh context never re-runs `registerCandidateExtension`).

But Reviewer B (Devin) flagged a **different** correctness Bug the report did NOT cover: *"Module's associated declarations are added twice"* via the `getAssociatedDeclsForDecl` path (`slang-check-shader.cpp:3456`) — that path also consults `importedModulesList`, so seeding it can double-count on a *separate* consumer than the extension path. Lesson: when a fixer's process report claims "no double-add," verify it names the *specific consumer* it audited — the same seeded list often feeds multiple consumers (candidate extensions AND associated decls), and a report can be correct about one while silent on the other.

Both Devin and Reviewer C independently flagged the sibling asymmetry: `Module::_validateSpecializationArgsImpl` (~line 3215) sets `m_module` but does NOT seed `importedModulesList`, so the two adjacent specialization-validation boundaries now discover extensions differently with no stated reason.

Process note: this PR merged (2026-07-16) before Reviewer A (correctness) ever completed — A's background shell was lost twice across session boundaries, so the double-add Bug was never adjudicated by the correctness pipeline before merge. When a review spans session boundaries, A being lost is a real gap; re-check A produced `final-review.md` before assuming a verdict exists. See [[reviewer-outputs-survive-teardown]].

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784291828247-devin-can-surface-a-correctness-bug-the-fixer-s-pr.md`_
