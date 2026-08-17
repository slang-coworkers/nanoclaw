---
title: "[approver/challenger] visibility-elevation feature must probe the UseOfLessVisibleType cap-check"
type: learning
topic: review-approval
source: learnings/1784417628061-approver-challenger-visibility-elevation-feature-m.md
---

# [approver/challenger] visibility-elevation feature must probe the UseOfLessVisibleType cap-check

**Symptom:** PR #12151 (shader-slang/slang) makes unmodified members of an effectively-`public` struct/class default to `public` in Slang 2026 (a semantics-only insertion in `getDeclVisibility`, slang-check-decl.cpp). Devin (only tier — bot-authored `fix/issue-9153`, production review skips) reported 0 bugs; the PR's 4 tests all pass on CI. The synthesized-review verdict was APPROVE. Nothing in the doc, the diff, or Devin flagged the downstream interaction.

**Root cause / the gap:** Any feature that *raises* a decl's effective visibility must be checked against every consumer that compares that visibility to something else. Two consumers read `getDeclVisibility(varDecl)` for struct fields:
1. `checkVisibility(varDecl)` — runs per-field from `SemanticsDeclHeaderVisitor::checkVarDeclCommon` (slang-check-decl.cpp:2947) → slang-check-modifier.cpp:2360-2371 emits **hard error 30604 `UseOfLessVisibleType`** (an `err`, slang-diagnostics.lua:2337-2342) when a member's *type* is less visible than the member. Elevating an unmodified field to Public while its type stays Internal flips `typeVis < thisVis` from false→true ⇒ a 2026 `public struct Foo { Helper h; }` with internal `Helper` compiles at 2025 but **errors at 2026**. Reachable, common, migration-breaking, untested.
2. `createInvokeExprForSynthesizedCtor` (slang-check-conversion.cpp:944-958, 873-887) — `memberVis < structVis` excludes less-visible members from the synthesized ctor (issue #11005). Elevation widens the public ctor signature.

**How to catch it:** When a PR changes what `getDeclVisibility` returns (or any effective-visibility default), grep for every reader that *compares* visibilities — `checkVisibility`, `getTypeVisibility`, `memberVis`/`structVis`/`typeVisibility < thisVisibility`, ctor-synthesis, initializer-list. Ask deepwiki "does X depend on member visibility?" THEN verify the cited file:line in source (deepwiki prose is a lead, not proof). A visibility-*raising* change is dangerous precisely where a cap-check would newly fire; a visibility-*lowering* change is dangerous at lookup/access sites. The new tests passing green does NOT clear this — the tests only cover shapes the author thought of; the gap is the shape they didn't (public struct + less-visible field type + 2026).

**Fix (decision):** ABSTAIN_POLICY / OPEN_GAP — not BLOCK (genuinely uncertain whether the new 30604 error is intended-by-design: you arguably *shouldn't* expose a public field of an inaccessible type, so forcing annotation/error may be correct) and not WOULD_APPROVE (untested cascade + real migration blast radius + uncertainty ⇒ conservative-lean). Corroborated by the live_late human signal: jkwak-work COMMENTED (not approved) "will discuss with Yong before merge." Generalizable: **a language-version-gated default-visibility change is a maintainer design call whenever it can newly trip a visibility cap-check on previously-valid code; the approver withholds rather than rounds up.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784417628061-approver-challenger-visibility-elevation-feature-m.md`_
