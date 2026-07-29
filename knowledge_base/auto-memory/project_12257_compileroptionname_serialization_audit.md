---
name: project_12257_compileroptionname_serialization_audit
description: "slang#12257 — systematic CompilerOptionName serialization audit + exhaustiveness enforcement; P3 tech-debt spun off from"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4bf734bb-e769-4874-b477-e6643eaea7d4
---

# slang#12257 — CompilerOptionName serialization audit + exhaustiveness enforcement

Self-filed by `nv-slang-bot[bot]` (07-28) as a deliberate follow-up to PR #12243 / issue [[project_12220_debugentrypoint_cmdline_options_glevel]]. #12243 fixed the *immediate* missing `CompilerOptionSet::writeCommandLineArgs` cases for `DebugEntryPoint` `-g`; per @pdeayton-nv's review the *structural* fix was pulled out to keep #12243 focused. This tracks doing it properly.

**Three requested parts:**
1. Classify every `CompilerOptionName` → serialize / represented-elsewhere-or-derived / omit.
2. Better abstraction than the inline `switch` in `writeCommandLineArgs` — spellings from one place, round-trip through the parser value tables.
3. Exhaustiveness enforcement — unit test iterating `[0, CountOf)` failing on any unclassified option (codebase builds `-Wno-switch`, so no compile-time signal).

**Triage (slang-triager, verified @ ae363b754):** enhancement / tech-debt, severity low, **P3**, component = compiler-options/serialization. No user bug, no crash, no regression — latent-bug prevention.
- `writeCommandLineArgs` = hand switch, `source/slang/slang-compiler-options.cpp:44-180`, 27 arms, no outer `default` → any option absent from switch is silently dropped (the exact #12220 class).
- Spelling mapping is *already partial SSOT*: `writeCommandLineArgs` pulls spellings from `globalSession->m_commandOptions` (`findOptionByUserValue`, :48) — same registry parser uses (`initCommandOptions()` at `slang-options.cpp:190`). Residual switch job = per-option arg *formatting* (Capability `+`-join, `-D`/`-I`, Vulkan bind-shift, `-O` level, flag-only). Part 2 = push that residual + classification into the registry.
- `classifyCommandLineOption` helper NOT on master (grep=0); reference impl (Serialize/RepresentedElsewhere/Omit/Unclassified + `[0,CountOf)` test) lives in #12243 history.
- Enum is public ABI (`include/slang.h`) — append-only, ABI-safe; keep `CountOf` sentinel implicit (#11852 collision precedent).

**Approaches:** A = full 3-part structural fix (highest value, but part 2 is a real design fork needing maintainer buy-in before ~156-option refactor). B = exhaustiveness-test-only, defer 1-2 (closes actual silent-drop gap, low risk, keeps switch). C = park (recommended).

**VERDICT: PARKED pending maintainer prioritization.** Pure P3, part 2 needs maintainer to pick the shape (bikeshed risk), naturally sequences *after* #12243 merges. No research lost — reference impl in #12243 history.
**RESUME TRIGGER:** maintainer / @pdeayton-nv says "make a PR" or assigns, OR #12243 merges and someone schedules the follow-up → slang-fixer (recommend B-then-A, or A if abstraction shape agreed).

**GitHub footprint:** triager posted proportionate 5-bullet triage/park comment — https://github.com/shader-slang/slang/issues/12257#issuecomment-5110499121 (closest-to-the-state). Type left unset (neither clean Bug nor Feature); no labels.

Canonical thread: `gh-issue-shader-slang/slang-12257`. Triager memo: triage-12257.md. Chain CLOSED (parked) 07-28.
