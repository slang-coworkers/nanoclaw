---
title: "GLSLModuleModifier→SourceLanguage refactor: how PR 13112 addressed the known pitfall + a cross-reviewer convergence signal"
type: learning
topic: review-process
source: learnings/1789515728058-glslmodulemodifier-sourcelanguage-refactor-how-pr-.md
---

# GLSLModuleModifier→SourceLanguage refactor: how PR 13112 addressed the known pitfall + a cross-reviewer convergence signal

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789514027199-hbnwuz
written_at: 2026-09-15T23:42:08.058Z
---

# GLSLModuleModifier→SourceLanguage refactor: how PR 13112 addressed the known pitfall + a cross-reviewer convergence signal

Reviewing shader-slang/slang#13112 (replace payload-less `GLSLModuleModifier` with `ModuleSourceLanguageModifier`, migrate 3 consumers behind `isModuleGLSLFlavored() = AllowGLSL-option || getModuleSourceLanguage()==GLSL`). Two takeaways:

1. **The prior refactor pitfall is correctly resolved by design, not by luck.** The known trap (see learning "converting-option-derived-glsl-bool-to-sourcelanguage") is that "GLSL permitted here" (`-allow-glsl`/AllowGLSL mode) ≠ "the source language is GLSL", and that `TranslationUnitRequest` is nullptr on reflection/language-server paths so the old `GLSLModuleModifier` fallback was load-bearing. PR 13112 handles both: the predicate keeps the `AllowGLSL` OR-term (so a plain `.slang` file under `-allow-glsl` still reads as GLSL-flavored), and the modifier is now attached to *every* module's AST at parse time (reachable via `getModuleDecl(decl)` regardless of any `TranslationUnitRequest`), with `getModuleSourceLanguage()` defaulting to `Slang` when absent. When reviewing this class of refactor, verify these two things explicitly — the correctness (ir-correctness) subagent confirmed AllowGLSL is read from the same `linkage->m_optionSet` at both parse and check time.

2. **When correctness (Reviewer A) AND clarity (Reviewer C) independently flag the same thing, treat it as high-signal.** Here both flagged the new modifier's `sourceLanguage` field defaulting to `SourceLanguage::Unknown` while `getModuleSourceLanguage()` returns `Slang` for an absent modifier — two spellings of "not GLSL". Zero impact today (only `==GLSL` is tested) but a latent trap for the follow-up PRs that will read `==Slang`/HLSL. The fix is producer-side normalization (or `SLANG_ASSERT` the invariant), matching the CLAUDE.md "one canonical representation per value" rule. Groundwork PRs that add write-only fields for future consumers are a recurring source of these "canonical value / dead duplicate" nits.

Also: Devin (Reviewer B) returned no findings here, and its commit-freshness scrape came back "unknown" — always note that caveat in the verdict rather than treating a clean Devin as confirmation for head.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789515728058-glslmodulemodifier-sourcelanguage-refactor-how-pr-.md`_
