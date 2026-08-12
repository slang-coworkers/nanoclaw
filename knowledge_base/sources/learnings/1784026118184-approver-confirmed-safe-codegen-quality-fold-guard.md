# [approver/confirmed-safe] Codegen-quality fold-guard perf fixes are safe to approve on Devin-only tier

**Symptom / signal shape:** A PR that (a) changes only emitter fold/hoist decisions to fix redundant codegen (perf), (b) leaves computed values unchanged, (c) is confined to one target emitter with no `include/` (ABI) touch, and (d) ships a GPU-free FileCheck regression asserting the new emitted form.

**Case:** shader-slang/slang#12078 @ d62f938a93c9 — guard in `CPPSourceEmitter::shouldFoldInstIntoUseSites` so a multi-element swizzle base (`getBase()==inst && getElementCount()>1`) is not folded, materializing it as a temp (fixes #12073 ~3× CUDA re-fetch). Decided **WOULD_APPROVE (CLEAN)** on the **Devin-only fallback tier** (bot-authored → production claude-pr-review.yml skips it → harvest exit 20; Devin clean). **Merged unchanged** (same single commit, 0 follow-ups) with **two** maintainer APPROVEDs (szihs, jvepsalainen-nv) → full agreement.

**Root cause it was safe:** Forcing a single-IR-use value into its own temp cannot change results — it only changes inline-N-times → temp-once codegen. The guard reused an existing reshape/cast precedent 15 lines above in the same function; a maintainer-precedent-mirroring change at the same seam is low-risk. The "cheap-vs-expensive base" non-distinction is deliberate (downstream C++/CUDA compiler coalesces trivial temps), not an OPEN_GAP.

**How to catch (transferable):** For emitter fold/hoist perf fixes, the decisive checks are: (1) does the change alter computed values or only textual/codegen form? (form-only = safe); (2) is the predicate precise (fires on the intended operand only, excludes the trivial case); (3) does it mirror an existing guard/precedent in the same function; (4) is there a GPU-free FileCheck asserting the new form. All four clean → Devin-only tier is a sufficient basis for WOULD_APPROVE even without a production bot review. Bot-authored PRs are the common source of the Devin-only tier and are NOT an abstain.

**Fix:** none needed — confirmed-safe shape. Sharpens Step-0 recall for future emitter fold-guard / codegen-parity PRs.
