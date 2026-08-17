---
title: "PR #12304 empty-struct public-decoration removal review — REQUEST_CHANGES (wrong layer)"
type: learning
topic: review-process
source: learnings/1785468944911-pr-12304-empty-struct-public-decoration-removal-re.md
---

# PR #12304 empty-struct public-decoration removal review — REQUEST_CHANGES (wrong layer)

shader-slang/slang#12304 (draft, fix #8125): jkwak's dictated minimal fix deletes the `if(as<PublicModifier>){addPublicDecoration}` block in `addLinkageDecoration` (slang-lower-to-ir.cpp:1432) so `public` decls no longer get `IRPublicDecoration`. Intent: `IREmptyTypeLegalizationContext::isSimpleType` (slang-ir-legalize-types.cpp:4104) RETAINS empties carrying PublicDecoration, so a public empty struct survived to CPU/CUDA emit as a 1-byte member → offset shift → OOB/SIGSEGV (the #8125 slangpy layout mismatch).

**Verdict: REQUEST_CHANGES — 2 bugs / 3 gaps / 1 question.** The fix is at the WRONG LAYER (producer, not consumer). Removing PublicDecoration at the producer erases it for EVERY plain-`public` decl, not just empty structs.

**Root of the blocking bug (verified from source + empirically + codex xhigh):** three CPU/CUDA emit consumers — `isPublicOrExportedFunc` (emit-cpp:994, gates the `static` prefix), `_isExported` (2007), `_getExportStyle` (2051) — key on `PublicDecoration || HLSLExportDecoration` but NOT the still-present plain `ExportDecoration`. Reason they can't use Export: `addExportDecoration` is applied unconditionally to every non-imported decl (lowering:1430), so Export can't distinguish a `public` symbol from an internal helper — PublicDecoration was the sole signal. After the PR a plain `public` func (no `export`/`[HLSLExport]`/entrypoint) is emitted `static` → host `ISlangSharedLibrary::findFuncByName` returns null. Documented contract: docs/cpu-target.md:208-224 (`public`/`public __extern_cpp` host-interop). Empirically confirmed with pre-PR binary: `public int addTwo` → `extern "C"` + NON-static; `static int addThree` → `static`. NOTE the annotation is `extern "C"` not `SLANG_PRELUDE_EXPORT` due to a pre-existing arg-order swap at emit-cpp:2063 (`_getExportStyle(inst, isExternC, isExported)` vs signature `(_, outIsExport, outIsExternC)`).

**What is SAFE (don't overclaim):** cross-module IR linking + DCE keep-alive unaffected — PublicDecoration is NOT an IRLinkageDecoration (insts.lua: only import/export are under LinkageDecoration); linking (link.cpp:2472/1368) + DCE keepExportsAlive (dce.cpp:549/565) gate on ExportDecoration, still emitted. Golden edit (multi-target-module drops two `[public]` on NON-empty funcs) is legitimate — `[export]`+`[availableInDownstreamIR]` retained.

**Extra findings from Reviewer A:** #8125 hazard SURVIVES for `export`/`[DllExport]`/`__extern_cpp` empty-struct spellings (isSimpleType still retains those); 3 nightly golden tests assert `[public]` and will break (docs/generated/tests/design/cross-cutting/serialization/*).

**Recommended fix (all reviewers converge):** move to the consumer — make `isSimpleType` return false for a zero-field struct regardless of linkage decoration → fixes ALL spellings AND no visibility regression. GUARDRAILS honored: do NOT reintroduce CI-rejected #11657 global `removeEmptyStructFields`; the zero-field isSimpleType check is narrow, distinct from csyonghe's isSimpleType-redesign direction.

**Reviewer convergence pattern (disagreement=signal):** Devin (B) 0/0/0 — corroborated the fix MECHANISM but missed the blast radius entirely. Clarity (C) flagged the compiler-wide reach (C002) but rated it clarity-only/non-blocking (its lower bar). Correctness A + codex + source verification rate it BLOCKING. When a change deletes a decoration at its producer, always inventory ALL consumers of that decoration — a "minimal" producer deletion can have compiler-wide blast radius.

**Ops:** gh auth-status reported invalid token but `gh pr diff`/`gh api` both READ the public repo fine → live pr mode worked (don't trust auth-status alone). All 3 reviewers ran foreground/bounded-poll (no monitor-strand). File-only delivery to parent (draft, no `<github-post-authorized />`).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785468944911-pr-12304-empty-struct-public-decoration-removal-re.md`_
