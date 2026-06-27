---
name: PENDING — #11780 simplifyIR regression (held on #11779)
description: slang #11780 simplifyIR perf regression triaged+reproduced; fixer HELD — Approach B dependency-blocked on open PR #11779, may prototype Approach A only, no PR without Main's go
type: project
originSessionId: af82972d-16a9-48ce-93a3-15be9834a72f
---
**slang #11780** — simplifyIR perf regression: differentiable numeric builtins (`sin`/`sqrt` on `float`) pull `float`'s dead `IDifferentiable` closure (dzero/dadd/Differential + fwd/bwd derivs) into non-auto-diff shaders. Triaged + reproduced (mechanism) at HEAD `b1bdd88d4` by slang-triager; verified 5-bullet posted to GitHub, Type=Bug + `reproduced` label set. Classification: regression / medium / P2 / IR-linking+specialization + autodiff. Author jvepsalainen-nv.

- **Mechanism:** `sin`/`sqrt` carry no derivative attrs; their `T:__BuiltinFloatingPointType` constraint pulls `float:IFloat` (`IFloat : IDifferentiable`, core.meta.slang:304) + base-witness closure. #9808 dropped the linker's `useAutodiff` gate + marked tables `[KeepAlive]`/`[HLSLExport]` → cloned into non-diff programs, survives simplifyIR #1, not collectible until late `unpinWitnessTables`+DCE (slang-emit.cpp:1250/1446/1472). NB: the `IFloat:IDifferentiable` line itself predates #9808 (#3317, 2023); #9808 only removed the gate.
- **Scope-split vs #11779 CONFIRMED:** #11779 defers only *unreferenced* differentiable tables (per-compile linkIR floor); #11780's entries are *referenced* via the structural conformance and still cloned on demand (slang-ir-link.cpp:2055-2062) → **NOT subsumed** by #11779.

**Fix status: PREPARED + HELD BOTH (Main decision 2026-06-26, HOLD BOTH).** Fixer verified mechanism + exact change sites + risk for both approaches at HEAD b1bdd88d4; opened NO PR, edited NO source, posted NO comment. Prepared plan: `slang-11780-prepared-plan.md` (sent via inbox).
- **Approach B** (extend #11779's final-codegen-link gating so a non-AD link skips cloning the structurally-referenced `IDifferentiable` entries) is **HARD-dependent on #11779, not merely "sequenced"** — it references the `isFinalCodegenLink` flag #11779 introduces, so a master-based B literally won't compile until #11779 merges. Basing on #11779's live branch is forbidden (stacked-base clobber). → inherently a post-#11779 follow-up.
- **Approach A ruled UNSAFE** (was the "stack-free fallback"): its safe form needs the same `IDifferentiable` targeting as B (#11474 predicate-narrowness); its early unpin+DCE would run **before** specialize/finalizeAutoDiff → silent-miscompile ordering risk only a build can clear; and it's symptom-relief only (still pays the link clone). Not a viable shortcut.
- **Contributor-owned, deferred-by-design:** @jvepsalainen-nv authored the issue AND #11779 AND explicitly scoped this codegen-side half off as their own follow-up — a bot PR would compete with open contributor work.
- Fixer's local build is **disk-blocked** (~8.2G free / 97%), so neither approach is locally verifiable.

**Disposition: HOLD BOTH, no bot PR, defer to the contributor's #11779 follow-up.** Verdict comment (cmt 4809294055) edited in-place to reflect the held/deferred disposition. Available to draft B / assist only if @jvepsalainen-nv or a maintainer requests once #11779 lands.

**Why:** B can't compile without #11779; A is unsafe + symptom-relief; issue+companion-PR author owns this half — opening a bot PR would step on active contributor work.
**How to apply:** RELEASE trigger = #11779 merges AND (contributor invites help OR a maintainer asks us to take over). simplifyIR *magnitude* vs pre-#9808 (2026.5) baseline NOT independently verified (needs `tools/compile-perf` + Release baseline). Maintainer area: @saipraveenb25 (#9808) + @jvepsalainen-nv. Broad perf umbrella: #11474, no deadline. If a webhook lands on #11780 or #11779 merges, re-evaluate via slang-triager (don't direct-dispatch the fixer — double-dispatch risk).
