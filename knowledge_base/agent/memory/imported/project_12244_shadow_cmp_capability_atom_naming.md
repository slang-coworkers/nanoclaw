---
name: project_12244_shadow_cmp_capability_atom_naming
description: "slang#12244 shadow-comparison texture capability atom naming cleanup — PARKED, tracking issue"
metadata: 
  node_type: memory
  type: project
  originSessionId: c1c4f095-925e-4615-a815-5d88c3359068
---

# shader-slang/slang#12244 — shadow-comparison texture capability atom naming cleanup

**STATUS 07-30: ✅ MERGED / CLOSED (TERMINAL).** PR #12248 verified (gh) `state=MERGED` by **@jkwak-work**, merge commit **`be27d078706867288523b4c98faca89aadfd9702`** on `master`; issue #12244 CLOSED/COMPLETED (auto-closed via `Closes #12244`). Footprint comment 5099408494 patched in-place to "Resolved — merged". Chain terminal; re-engage ONLY on a fresh substantive human comment (none expected). Final change: `texture_shadow` (=`texture_sm_4_1`) + `texture_shadowbias` (byte-identical mirror of `texture_shadowgrad`) aliases, 17 name-only `[require]` re-points in `hlsl.meta.slang`, both auto-gen capability docs regenerated (additive-only) — behavior-neutral + ABI-safe (both verified). Prior approval was HEAD-bound @482df00ec0. Details below.

Bot-filed tracking issue (author nv-slang-bot) at **jkwak-work**'s request, split off from #9085 (GLSL support for `SampleCmpBias`/`SampleCmpGrad`) review to avoid expanding that PR's scope. Related: #11156 (issue #9074).

**Nature:** enhancement/cleanup · low · P3 · core-module capability atoms (`source/slang/slang-capabilities.capdef` + `source/slang/hlsl.meta.slang`). Behavior-neutral. Type=Bug label left as-is by triager.

**Problem:** `SampleCmp*` `[require]` atoms don't match op names — plain `SampleCmp`/`SampleCmpLevelZero` require `texture_shadowlod` (a `…lod`-named atom, poor fit); `SampleCmpBias` (LOD-bias) grouped under `texture_shadowgrad` (gradient-named); `SampleCmpLevel` split across `texture_sm_4_1`/`texture_shadowlod`.

**Proposed taxonomy (jkwak-work):** add `texture_shadow` + `texture_shadowbias` atoms; `SampleCmp`/`SampleCmpLevelZero`→`texture_shadow`, `SampleCmpLevel`→`texture_shadowlod`, `SampleCmpGrad`→`texture_shadowgrad`, `SampleCmpBias`→`texture_shadowbias`.

**Triager solution space (triage-12244.md):**
- (A) full taxonomy incl. SampleCmpBias→texture_shadowbias.
- (B) reduced scope jkwak already OK'd — add only `texture_shadow`, **leave Bias/Grad under `texture_shadowgrad`** ("fine for now").
- Both behavior-neutral (new atoms ≡ current expansions; **SM6.8 floor `_sm_6_8` retained**; preserve #11156 baseline-vs-`GL_EXT_texture_shadow_lod` split for GLSL forms).
- **Guardrail:** `texture_shadowlod` is SHARED with ~57 GLSL forms → must ADD atoms + re-point, NOT rename.
- Also regenerate the auto-gen capability-atoms doc; normalize one incidental SampleCmpLevel inconsistency (hlsl.meta.slang:3144 vs :3204).

**Status (updated 07-28):** RESUMED — jkwak-work commented on #12244 (issuecomment-5098694666) "make a PR with (A) full taxonomy incl. SampleCmpBias → texture_shadowbias". **Scope A chosen.** Fixer DISPATCHED via slang-triager; scope-A build in progress. GitHub posting authorized (real @nv-slang-bot maintainer mention). Drafts-only guardrail: open draft PR, merge operator-gated; call report_pr_created on open.

**Review artifact:** jkwak also asked for a before→after comparison table (issuecomment-5098699014), then refined it (issuecomment-5098749304: drop "line"+"behavior" cols, add first-SM-version col). Triager produced it and **edited comment 5098717191 in place**. Columns now: function · first SM · current atom → proposed atom; consolidated to one re-point table (both sampler families identical per variant). SM data verified vs MS HLSL docs + DXC hctdb (SampleCmp/LevelZero SM4.0 [arrays 4.1]; SampleCmpLevel SM6.7; SampleCmpBias/Grad SM6.8) — overrode a wrong DeepWiki SM5.1 claim.

**Re-point accounting (matches table):** 8 overloads→`texture_shadow`, 3→`texture_shadowlod` (hlsl.meta.slang:3144 no-op), 6→`texture_shadowbias`; `sm_5_0` + all `SampleCmpGrad` + offset/status overloads left as-is.

**DRAFT PR #12248** (07-28): https://github.com/shader-slang/slang/pull/12248 — branch `fix/issue-12244` @ `482df00ec0`, base master. +35/−17: `slang-capabilities.capdef` (+8), `hlsl.meta.slang` (+17/−17 pure name-only re-point, 0 logic), `docs/user-guide/a4-02-reference-capability-atoms.md` (+8), `docs/command-line-slangc-reference.md` (+2). Closes #12244; `pr: non-breaking`; behavior-neutral by construction (new atoms byte-identical expansions of what they replace). Issue footprint comment 5099408494. Red CI run 30324399550 = benign draft priority-yield, NOT a real failure (real pull_request CI skipped on draft). No tests added (behavior-neutral; 5 SampleCmp suites green locally).

Re-point accounting: 8→`texture_shadow`, 3→`texture_shadowlod` (:3144 no-op), 6→`texture_shadowbias`; sm_5_0 + all SampleCmpGrad + offset/status left as-is.

**Review (07-28, IN FLIGHT):** slang-reviewer running. Reviewer B (Devin) COMPLETE + CLEAN (0 bugs/0 flags/0 informational, confirmed taxonomy). Reviewer A (correctness) + C (clarity) running (~20-30 min). codex CODE/PLAN/OUTPUT approve (PLAN caught the missed 2nd doc regen). Awaiting merged A+C verdict → reviewer posts on PR #12248, reports back on canonical thread.

**GLSL/SPV provenance (07-30, jkwak Q cmt 5128196240 → answer 5128255230, verified at HEAD 7c58a326b):** Bias path uses **`Bias`, never `Lod`** — SPIR-V spells it `Bias` image operand on `OpImageSampleDrefImplicitLod` (the `…ImplicitLod` is the opcode-family name, NOT a Lod operand; Bias/Lod are distinct mutually-exclusive operands); GLSL spells it trailing-bias `texture(…, bias)`. Grad = `Grad`. Only `…Level` forms use `Lod`. Two surfaces: (1) HLSL `SampleCmpBias`/`SampleCmpGrad` methods are `hlsl_spirv`-only (no GLSL lowering); (2) GLSL's own `texture(…Shadow,bias)`/`textureGrad(…Shadow,…)` builtins exist separately (carry `texture_shadowlod`). `GL_EXT_texture_shadow_lod` is the only GLSL extension, and only for LOD forms on 2DArray/Cube/CubeArray shadow types (#11156 split); SPIR-V needs no extension for any comparison-sample op. **This VALIDATES the scope-A `texture_shadowbias` name** (a `…lod`-named atom would misdescribe the bias fn) → NO naming change to PR #12248.

**ABI/compat VERIFIED (07-30, jkwak on-PR Q issue-comment 5131612605 → fixer answer 5131641506, triager independently verified):** NO ABI break. `SlangCapabilityID` is opaque + name-resolved (`findCapability(char const* name)`, slang.h:4189; header explicitly says IDs are NOT version-stable → look up by name); `CapabilityName`/`CapabilityAtom` live only in generated internal headers, never in `include/`; public lookup is a name hash. Inserting the 2 atoms mid-list shifts only internal positional enum values no public API exposes. Nuance (non-blocking): atoms ARE serialized by value into internal IR/`.slang-module` (`IRRequireCapabilityAtomDecoration` reads `intVal`), but that format is already not cross-version-stable (recompiled per compiler version) and every prior capdef addition shifted these same values without being "breaking" — so `pr: non-breaking` conclusion HOLDS + matches established practice.

**Next:** merged review verdict → maintainer approve → flip draft ready + merge (OPERATOR-gated).

Original park: verdict posted #12244#issuecomment-5097654203. Matches self-filed-and-deferred park pattern. See [[feedback_reopen_not_release_parked_feature]].

## ✅ 2026-08-07T15:42:15Z — TERMINAL, FULL ARC CLOSED (fixer-reported, Main-verified end to end)

**PR #12309 MERGED** by **`fknfilewalker`** — merge commit `34e4604f0179fe67473dfc9efb6f25eb3a807d0c` into `master`. Note the merger is a **different maintainer than the approver** (`jkwak-work`), so two humans touched it.

✅**I verified the CONTENT on master, not the merge event** (the fixer's stronger claim, independently reproduced):
- `slang-capabilities.capdef@master:2438` → *"Capabilities required for shadow texture sampling with gradients (SampleCmpGrad)."* — the stale **"bias and"** (C001) is gone.
- `:2428` carries the explicit-LOD / `SampleCmpLevel` note (C002).
- `docs/user-guide/a4-02-reference-capability-atoms.md@master:1588-1590` — the **regenerated** doc text matches the capdef verbatim.
- **`grep -c 'bias and'` → 0 in BOTH files.** ⭐The generated-doc leg is the one usually skipped, and this repo's doc is auto-generated with a "never edit directly" rule, so a source fix without a regenerate would have left the two disagreeing.

✅**"No push at any point on the approved branch" — CONFIRMED, and this is the load-bearing one:** `jkwak-work` APPROVED @`98083f9d5e4a` and the **head at merge was `98083f9d5e4a`**, `commits=1`, one commit row. ⇒ approved SHA == merged SHA, so the approval was never at risk. **`BEHIND` resolved itself at merge with no rebase and no force-push** — the standing rule held under pressure: *a `BEHIND`/`BLOCKED` state on an approved head is the maintainer's to resolve, because rebasing it can dismiss the approval.* See [[feedback_ci_terminal_is_not_chain_terminal_arm_the_deciding_axis]].

⭐**Merged WITH the Falcor red outstanding** — independent maintainer corroboration of the flake read (tracked as #12145, 44 occurrences/16 PRs). A maintainer merging over a red is evidence about that red's credibility, though it is corroborating, not decisive.

**Full arc:** #12244 → PR #12248 (taxonomy, merged `be27d078`) → peer review found C001 → PR #12309 (doc fix, merged `34e4604f`). Both behavior-neutral. Worktree pruned, sentinel cleared, CI watcher deleted. **Chain CLOSED — reopen only on a fresh substantive human comment.**