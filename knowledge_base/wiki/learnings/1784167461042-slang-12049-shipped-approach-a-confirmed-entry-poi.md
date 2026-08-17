---
title: "slang#12049 SHIPPED — Approach A confirmed: entry-point -specialize conformance scoped to getModule()+getModuleDependencies()"
type: learning
topic: slang-compiler
source: learnings/1784167461042-slang-12049-shipped-approach-a-confirmed-entry-poi.md
---

# slang#12049 SHIPPED — Approach A confirmed: entry-point -specialize conformance scoped to getModule()+getModuleDependencies()

# slang#12049 SHIPPED (PR #12052 merged 2026-07-16) — the triaged Approach A landed verbatim

Follow-up to the earlier root-cause learning ("generic entry-point `-specialize` can't see primary-file extension conformances"). The fix merged **exactly as triaged** — a clean confirmation of the recommended layer and seam.

**Final fix (PR #12052, merge commit `89443da3660e`, `Closes #12049`, merged by jkwak-work):** in `EntryPoint::_validateSpecializationArgsImpl` (source/slang/slang-check-shader.cpp) replace the module-less `SharedSemanticsContext(getLinkage(), nullptr, sink)` with one scoped to `getModule()`, and seed `importedModulesList` (dedup via `importedModulesSet`) from `getModuleDependencies()`. `getModuleDependencies()` self-includes the owning module (via `Module::Module`'s `addModuleDependency(this)`), so the primary command-line TU's own `extension … : IDenorm` conformances become visible at the specialize boundary — the same point of view an in-body generic call already had. +33/−1 in the source file + 1 regression test. Fallback: when `getModule()` is null, keep the prior module-less behavior.

**Why this seam and not `importModuleIntoScope()` (jkwak's review question, RESOLVED in favor of direct-seeding):** the conformance check needs only the flat *candidate-extension list*, not a lookup `Scope`. `importModuleIntoScope()` over-reaches (it builds a `Scope*` the seam doesn't have and doesn't need), and `__exported` recursion is already subsumed by the module dependency closure. jkwak resolved that thread = direct-seeding accepted, no code change.

**Test lesson (jkwak's other review point):** the initial test used `-target spirv-asm ... -skip-spirv-validation` to isolate from the sandbox's missing downstream spirv-opt/glslang. jkwak asked for it dropped so the repro runs the **full validated SPIR-V path** — landed test has no `-skip-spirv-validation` and still passes 2/2 (`-specialize float` + `uint32_t`) on Windows GPU CI. Takeaway: `-skip-spirv-validation` is fine for local triage-repro isolation, but a shipped regression test should exercise the validated path where CI can run it.

**Process notes for the chain:**
- The whole review→merge arc came back to the triager via the **parent** (stray a2a edge: fixer's `to=parent` resolved to the orchestrator, not the triager). Each relayed state change (draft→ready flip, APPROVE, MERGED) was independently re-verified against GitHub before folding into chain state — and that caught that jkwak's APPROVE was actually **at the current head** `c4c7d1837d94` (the relay named a 1-commit-older SHA), and that HEAD had advanced past where the internal slang-reviewer's combined verdict was computed (stale but non-blocking once the maintainer approved).
- Suppression rule worked as intended: once a **non-draft** PR with `Closes #12049` existed, no additional bot issue post was needed pre-merge; the merge auto-close is the definitive public artifact. The only bot issue comment was the initial triage 5-bullet (4937485580).
- Arc: triaged (Approach A + decisive import-vs-primary-TU discriminator) → fixed → draft PR → maintainer approved → merged, ~5 days.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784167461042-slang-12049-shipped-approach-a-confirmed-entry-poi.md`_
