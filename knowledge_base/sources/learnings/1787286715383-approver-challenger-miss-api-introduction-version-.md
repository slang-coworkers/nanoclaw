---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787274163971-9wcw9d
written_at: 2026-08-21T04:31:55.383Z
---

# [approver/challenger-miss] API-introduction-version claims in docs need ground-truth header verification, not internal consistency

**PR:** shader-slang/slang#12650 @25e349d158d6 (gate OptiX SER traverse wrappers by `OPTIX_VERSION >= 80000`). Decision: ABSTAIN_POLICY (`CRITIQUE_MUSTFIX:docs-optix-version-inaccuracy`).

**Symptom.** A PR that fixes a real bug with a correct code change *also* added a docs section (`docs/shader-execution-reordering.md`) asserting that `optixMakeHitObject` / `optixInvoke` / `optixHitObjectGet*` were "introduced in OptiX 8.1." Devin (0 flags) and my Step-3 challenger both cleared the docs — because they checked it for **internal consistency** with the prelude's gating (`>= 80100` HitObject block, `>= 80000` traverse block) and it *was* consistent. The DECISION_REVIEW critique gate (codex) fetched the actual NVIDIA/optix-dev 8.0.0 and 8.1.0 device headers and found the claim false: the entire SER/HitObject surface exists in **8.0.0** with byte-identical signatures (28 `optixHitObjectGet*`/`Is*` in both; only 8.1.0 device.h addition is the unrelated `optixGetGASPointerFromHandle`).

**Root cause.** An external-API version-floor claim is a claim about a *third party's* headers, not about the diff. Verifying it against the PR's own gating is circular: the prelude's `>= 80100` gate is itself possibly over-conservative (the symbols compile on 8.0.0), so "the docs match the prelude" carries zero bits about whether either is correct against OptiX ground truth. The safety observation *could not have come out otherwise* from a consistency check — the same failure shape the standing gate-probe warns about, one layer up (docs vs. real SDK, not codegen vs. flag).

**How to catch it.** When a diff (code comment, doc, or PR body) states "API X was introduced in version V" / "requires version V", treat V as a falsifiable claim and check it against the actual upstream headers at both V and V-1, not against the repo's own gating or the PR's prose. The upstream submodule pin is in `.gitmodules` + the `contents` API `submodule_git_url`. Note: `gh api` to a non-wired repo (e.g. NVIDIA/optix-dev) 401s through the OneCLI proxy — codex under `danger-full-access` could fetch them; if the challenger needs external headers it can't reach, that's an ABSTAIN input-gap, not a clear.

**Fix.** Added to the Step-3 challenger checklist: any external-API version-floor assertion in the diff/docs = probe the real headers. A docs-only factual error that undermines the PR's stated purpose (here: documenting the correct OptiX floors) is a `CRITIQUE_MUSTFIX` ABSTAIN, not a nit — even when the code is correct. It is NOT a BLOCK: BLOCK asserts a verified 🔴 code bug (Step-2 review-doc), and here the code is sound; the must-fix I cannot revise (never write to GitHub) routes to ABSTAIN_POLICY per the skill.
