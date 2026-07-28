---
name: project_12244_shadow_cmp_capability_atom_naming
description: "slang#12244 shadow-comparison texture capability atom naming cleanup — PARKED, tracking issue"
metadata: 
  node_type: memory
  type: project
  originSessionId: c1c4f095-925e-4615-a815-5d88c3359068
---

# shader-slang/slang#12244 — shadow-comparison texture capability atom naming cleanup

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

**Next:** await fixer [Fix Report] + PR# → triager forwards [Triage Resolution] on canonical thread. Merge operator-gated.

Original park: verdict posted #12244#issuecomment-5097654203. Matches self-filed-and-deferred park pattern. See [[feedback_reopen_not_release_parked_feature]].
