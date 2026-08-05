---
name: project_12339_include_occurrence_provenance
description: "#12339 SPIR-V debug info: carry include-occurrence provenance so DebugFunction ownership is resolvable — own-bot echo; MY OWN 'does not reproduce' finding was RETRACTED: I measured master, the issue describes an UNLANDED branch"
metadata:
  node_type: memory
  type: project
  originSessionId: session-12339-triage
---

# #12339 — include-occurrence provenance for DebugFunction ownership

**shader-slang/slang#12339**, filed **2026-08-04 13:22Z** by `nv-slang-bot[bot]` — **own-bot echo ⇒ NO re-triage, NO fixer dispatch, NOTHING POSTED.** 0 comments/labels/assignees. Successor of merged **#12148** (`0864e60e63`, merged 08-04 05:41Z by pdeayton-nv); near-successor of **#12150** (OPEN, assigned **pdeayton-nv**).

## 🔴 RETRACTION (same session, before publishing) — my "does not reproduce" finding was WRONG

I built a repro of the body's Symptom 3, measured it at master, found `variantFn2` scoped to the **entry point's** CU rather than f1's, and drafted a memo + index row asserting **"the worked example DOES NOT REPRODUCE"** and **"2 of 4 code claims are wrong."** Both headline claims were **wrong**. Caught before any GitHub post or dispatch; the memo and index row are rewritten from this measurement, not appended to.

**Defect 1 — I conflated "module-global fallback" with "bound to a real CU."** I measured the *outcome* of the fallback and read it as *absence* of the fallback.

Decisive measurement (`__include` case, `i.spvasm`), enumerating which files have a `DebugSource` but **no** `DebugCompilationUnit`:
```
DebugSources: {inc.slang, imain.slang}
CUs         : {imain.slang}
=> DebugSource but NO CU: ['inc.slang']
```
The mechanism, read at the source rather than inferred:
- `slang-lower-to-ir.cpp:15474-15480` emits a CU **only** `if (... && !source->isIncludedFile())` ⇒ an included file gets a `DebugSource` and **never** a CU ⇒ `mapDebugSourceToCompilationUnit` has no entry ⇒ `parentScope` is **null** (`:14701`).
- `slang-emit-spirv.cpp:10596-10604`: `if (auto irParentScope = debugFunc->getParentScope()) scope = ensureInst(...); if (!scope) scope = findDebugScope(debugFunc);` ⇒ null parent falls back to the **module-global** scope.
- `slang-emit-spirv.cpp:12190-12210` **sets that module-global scope to the entry point's CU** ("Also update the module-level debug scope to use the entry point's compilation unit").

⇒ **"falls back to the module-global scope" and "scoped to the entry point's CU" are THE SAME OBSERVATION.** So Symptom 1's *"keep a null parent scope and fall back to the module-global scope"* is **CORRECT**, and my "got a non-null CU, claim not observed" was me reporting the fallback as a refutation of the fallback. Symptom 4's fallback outcome is likewise **CORRECT at master**.

**Defect 2 — I "corrected" a claim the issue never made.** I wrote that the `slang-session.cpp` attribution was wrong because the only `createSourceView` there is the serialized-module path. Re-reading the body clause-by-clause: *"The `__include` path in `slang-session.cpp` **receives** the directive location but never **threads it into** view creation."* It does **not** claim the view is created there. And it verifies: `Linkage::findAndIncludeFile` (`slang-session.cpp:1964`) takes `SourceLoc const& loc`, creates **no** view, and the root view is made downstream at `slang-preprocessor.cpp:5103` with `SourceLoc::fromRaw(0)` — whose own comment says *"there is no 'initiating' source loc."* **The claim is right; I refuted a strawman.** (Same shape as [[feedback_gate_remedy_may_be_disjunctive_reread_it]] — a **reading** defect on a requirement, which no control catches.)

**Defect 3 — wrong tree.** `findIncludingNonIncludedSourceFile` and both cited tests really are absent from master (verified 3 ways, with non-zero controls). But the body says the resolution *"now counts distinct includers … and binds only when there is exactly one"* — **that logic is not at master**, so the issue is describing an **unlanded branch** (the fixer holds `wt-slang-12150`; per [[project_12150_include_line_cu_scoping]] this code lived in #12148's pre-strip head `4ccab1cc` and was stripped before merge). Measuring master and reporting "does not reproduce" is measuring **a different tree than the claim is about** — the exact defect the #12150 fixer session had *already saved as a learning* ("Before trusting a clean test result, verify you own the tree you measured"), which I then committed anyway.

## What actually survives, and at what confidence

- ✅ `slang-preprocessor.cpp:3728` — `createSourceView(sourceFile, &filePathInfo, directiveLoc)` — byte-exact at master.
- ✅ Symptom 1's mechanism (`__include` view built with no initiating loc ⇒ null parent ⇒ module-global fallback) — **verified at master**, both in code and in emitted SPIR-V.
- ✅ The root-cause argument (one `SourceFile` ⇒ one `DebugSource` ⇒ one map entry ⇒ per-expansion ownership not representable) — **consistent with everything measured**; the `!isIncludedFile()` gate is exactly that limitation.
- ✅ `findIncludingNonIncludedSourceFile` + both cited tests absent **from master** — true, and **expected** for an unlanded branch. **Not** evidence against the issue.
- ⚠️ **Symptom 3's specific "scoped to f1's CU because f1's occurrence was registered first" is UNVERIFIED, not refuted.** At master it cannot occur (no binding logic exists — everything falls back), so my repro could never have exhibited it. Testing it needs the **branch**, which is not in my container.
- ⚠️ **Untested:** the `views=27 matchFile=1 withInitLoc=0` instrumentation figure (requires an instrumented build of the branch).

**Net:** #12339 is **materially more credible than my draft claimed**. I have **no** refutation of it. The only defensible criticism left is a documentation one: the body reads as describing current master but describes an unlanded branch, and cites two tests that exist only there — which is what led me astray and could mislead a maintainer or fixer the same way.

## Routing

**Own-bot echo ⇒ no re-triage, no fixer, nothing posted.** Unlike #12337/#12338 there is **no verified additive fact to contribute** — my candidate finding was retracted, and per ⭐⭐ *over-retraction is its own failure mode* I am recording the retraction rather than publishing either the original claim or an inverted one. Posting my draft would have put a false non-reproduction on a maintainer-facing issue.

⛔ **Do NOT restate "#12339 does not reproduce" from any earlier note or index row.** That claim is withdrawn here at the top of the file, in place.

**Lessons:**
- ⛔⭐⭐⭐ **A FALLBACK'S OUTPUT IS NOT EVIDENCE THE FALLBACK DIDN'T FIRE.** I measured "has a CU" and concluded "was bound"; the CU *was* the fallback. **When a claim is "X gets no scope and falls back," the discriminator is whether X has its OWN entry — enumerate the objects that lack one** (`DebugSource` present / `CU` absent), never read the resolved end-state. Fifth instance of ⭐⭐ *match the check to the claim*.
- ⛔⭐⭐⭐ **"DOES NOT REPRODUCE" IS A CLAIM ABOUT A TREE — NAME THE TREE BEFORE PUBLISHING IT.** The issue described an unlanded branch; I measured master with a *correct positive control for master* (`merge-base --is-ancestor 0864e60e63 HEAD`=YES, `grep -c`=3) — **a well-formed control for the wrong scope reads exactly like a valid one.** Direct recurrence of ⛔⭐⭐⭐ *TICK-87: correct measurement over an UNVERIFIED SCOPE*, and of a learning the peer session on this very issue had already filed.
- ⛔⭐⭐ **RE-READ THE CLAIM CLAUSE-BY-CLAUSE BEFORE REFUTING IT.** "receives the directive location but never threads it into view creation" ≠ "creates the view here." I refuted the second. **Quote the clause you are refuting, verbatim, next to your measurement** — had I done that, the mismatch was visible without any new tool call.
- ⭐⭐ **THREE WRONG CONCLUSIONS, ZERO WRONG COMMANDS.** Every command ran clean and every number was real; the repro, the greps, the controls were all sound. The defects were *scope*, *semantics of the observable*, and *reading*. **Re-running anything would have re-confirmed the error** — cf ⭐⭐⭐ *every defect was in the MEASUREMENT; none was findable by re-reading the argument*, and its dual: **a defect in what the measurement MEANS is invisible to more measurement.**
- ⭐⭐ **A bot-authored issue that cites one byte-exact line number earns unearned trust in its other cites — and, symmetrically, one apparent miss earns unearned distrust.** `preprocessor.cpp:3728` verifying made me credulous; then a single misread made me sweep-condemn 4 symptoms. **Adjudicate PER ITEM** (cf codex's 12 real catches + 1 bogus item coexisting).

**RESUME** = pdeayton-nv/maintainer responds; a **non-bot** comment lands; or the #12150 branch work surfaces where Symptom 3 can actually be tested. Related: [[project_12150_include_line_cu_scoping]], [[project_11983_spirv_debugfunction_wrong_cu]], [[project_12181_debug_info_include_source_flag]].
