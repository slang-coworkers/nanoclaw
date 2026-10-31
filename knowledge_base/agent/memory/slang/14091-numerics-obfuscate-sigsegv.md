---
type: chain
title: slang#14091 — SIGSEGV compiling slang.numerics code with -obfuscate
description: Human-filed (HildarTheDorf) crash 2026-10-30 10:46Z. slangc segfaults on a generic IExponentialFunctions log() via `import slang.numerics` + `-experimental-feature -obfuscate`; fine without -obfuscate. R6 crash exemption (SIGSEGV + fenced repro) → triager may post. Triaged P2 (consumer-side obfuscated linkage names vs plain std-module IR); PR 1 = bug 1 only (crash→error, obfuscated↔obfuscated force-inline); bug 2 (std modules under -obfuscate) parked for maintainers.
tags: [crash, obfuscate, standard-modules, numerics, r6-exempt]
---

# slang#14091 — slang.numerics + `-obfuscate` SIGSEGV

**Report.** The reporter says it reproduces on 2026.17-25-gc7954ebd1 and master 1f0b33b86. A generic `foo<T : IExponentialFunctions>`
returns `log(value)` and is called with `float4` from a fragment entry point. With `-obfuscate` slangc segfaults; without it,
the code compiles.

**R6.** Human-filed, no labels, 0 comments at dispatch. A crash word plus a fenced block → exempt, so the bot may post right away.

**Dispatch (10-30 ~10:50Z).** slang-triager, thread `gh-issue-shader-slang/slang-14091` (a2a msg id 9). The ask: reproduce on master,
find which targets and module paths crash, find the root cause layer, post the 5-bullet, and hand off to slang-fixer if ready-for-fix.
My unverified guess: obfuscation strips names or locations that the serialized standard-module IR or decls depend on.

**10-30 10:48Z, the triager's finding (not verified by me).** It reproduced on master 1f0b33b86 (debug build). `-obfuscate` segfaults on every target: spirv, hlsl, glsl, metal, wgsl, cuda, cpp and dxil. The container has no gdb, so the triager is getting the backtrace another way.

**10-30 10:59Z: triaged as bug/high/P2, IR lowering of linkage names + prelink, all targets.** These are the triager's findings; I did not reproduce them.
- Root cause: an imported decl's linkage name is computed from the CONSUMER's `-obfuscate` flag (`isLinkageNameObfuscated`, slang-lower-to-ir.cpp:1555). It should follow how the OWNING module's IR was named. Std modules always ship non-obfuscated, so every reference to them from an obfuscated translation unit is hashed and cannot match.
- Crash site: `prelinkIR` (slang-ir-link.cpp:2667/2711). It adds a null TU IRModule to `irModules`, then dereferences an unchecked `findSymbols` miss. The force-inline import path (`lowerFuncDeclInContext` :13887) reaches it first.
- Variants: a user `.slang-module` gives the same SIGSEGV; plain functions give E45001; same-session source asserts at :13888. So `-obfuscate` alone is enough to trigger it.
- Approach A (recommended): a producer-recorded module decoration (e.g. `ObfuscatedLinkageNamesDecoration`), where an imported decl's name follows its owning module's flag. Needs a doc update to a1-03-obfuscation.md:44.

GitHub: bot 5-bullet posted 10:58:54Z (comment 6521032642), `reproduced` label + Issue Type Bug set by the triager. Not a regression, not a dup; related to #14000/#14004. Fallbacks: B = exempt precompiled std modules like core; C = crash hardening only (part of the fix either way). Memo: `/workspace/inbox/a2a-1793357958104-jit2ch/triage-14091.md`.

**10-30 10:59Z: slang-fixer claimed it.** Worktree `wt-slang-14091`, branch `fix/issue-14091` @ 1f0b33b86. It is building debug, then will add a repro test and implement Approach A. R6 crash-exempt, so a PR is allowed.

**10-30 11:26Z: reporter comment 6521514553 (HildarTheDorf, assoc NONE, no bot mention).** The reporter splits it into two bugs.
(1) Importing a non-obfuscated module from obfuscated code should give an error, not a crash.
(2) Importing std modules from `-obfuscate` code "will need some level of debate". Approach A would settle (2) by implementation.
I relayed it verbatim to the triager (a2a id 21, pinned to sess-1793357263232-kv4phj) for the triager and fixer to decide:
- scope the first PR to bug 1 (C plus a diagnostic) and leave A as a question for maintainers, or
- keep A and flag the policy change.
If they can't decide, it escalates to the operator.

**10-30 11:28Z: the triager decided on the merits, with no operator escalation; the fixer's agreement is pending.** PR 1 covers bug 1 only:
- (a) force-inline imports work when both sides use `-obfuscate`, via one linkage-name helper;
- (b) a clear error that names the module when a non-obfuscated module (including std modules) is imported into `-obfuscate` code;
- (c) `prelinkIR` stops adding the null module, with a release assert on a lookup miss.
Tests go in tests/obfuscate/. Bug 2 (A vs B) will be parked on the issue for a maintainer, with a one-shot re-check. The triager will post the split as a fresh comment.

**10-30 11:32Z: split agreed; the fixer took the scope at 11:30Z.**
- Split comment 6521592870 posted. It lists bug-2 options for a maintainer: A, an imported name follows its owning module; B, exempt std modules like core; C, keep the rule, now with a clear error.
- The A prototype stays local on `wip/issue-14091-approach-a`, outside PR 1. It bumps the module format 37→38.
- Bug 2 park timer: the triager's one-shot `t-e356e3`, 2026-11-06.
- PR 1 also folds in the `slang-ir-obfuscate-loc.cpp:333-336` stale-handle bug, read-before-update, which the triager confirmed in code.

**Side-find, my ruling 11:3xZ.** `ImmutableHashedString(String&&)`, slang-string.h:865-866: `slice(_Move(str)), hashCode(str.getHashCode())` hashes the moved-from string. I confirmed it on master. Don't file an issue. Fold the producer fix (`hashCode(slice.getHashCode())`) plus a unit test into PR 1, replacing the fixer's named-local workaround. Relayed via the triager (a2a id 31).

**10-30 12:41Z (the fixer's report).** CODE_REVIEW approved. The 7-commit PR-1 series is built. The per-commit build check and the full L40S suite are running (~30 min), and the draft PR follows.

**10-30 13:17Z: draft PR #14092 opened** (head 878dcd15b, `pr: non-breaking`, "Part of #14091", so the issue stays open for bug 2). CI has been triggered. The explanation comment and the issue status comment are posted. The fixer asked slang-reviewer for internal review; the [Fix Report] follows the verdict.

**10-30 14:05Z: slang-reviewer R1 = APPROVE_WITH_NITS on 878dcd15b** (0 bugs, 2 gaps). The fixer got it (seq 18/20); I got a CC with the review at `/workspace/inbox/a2a-1793369137373-1j7kf3/combined-review.md`. These are the reviewer's findings.
- Base: SIGSEGV and >60 s hangs. Head: every mismatch gives E45002 (force-inline) or E45001 (plain); both-obfuscated passes spirv-val. Full Release suite 11106/11109; the 3 failures are the known fp8-cuda tests.
- The obfuscate-loc fold-in is pinned by Debug CI (revert drill → slang-list.h assert).
- G1: `findImportLoc` misses `import`s in `__include`d FileDecls, so E45002 has no location. G2: no test that E45002 is reported once per module. A tested remedy patch (+75/−12) went to the fixer.
- Side-find, held for the triager: E45001 prints no symbol name or location when the location can't be printed. Master has the same behavior, and no existing issue covers it.

**10-30 14:27Z: [Fix Report].** The fixer applied the remedy (G1, G2, N1, N2 and the cheap N3 items). Head is now `b5016ec80`, 9 commits, 18 files, +328/−62. On GitHub (checked): draft, BLOCKED, 0 human reviews, 54 checks SKIPPED by the draft gate.
- Side-find E45001 (no name or location) is HELD unfiled under the 10-30 fan-out default; sent to the triager's held list (a2a 53).
- Ready-flip asked on the dashboard (id 55).
- 14:30Z: the triager reproduced the side-find on master and found no duplicate. It is held as **H6** in the triager's `memory/scratch/held-side-finds-14055-chain.md`. The [Fix Report] never reached the triager, so I forwarded it verbatim (a2a 57) for its [Triage Resolution].
- The local A prototype is `wip/issue-14091-approach-a`.

**10-30 14:31Z: [Triage Resolution].** The triager's part is closed, and the final 5-bullet was edited into bot comment 6523575616 in place. The triager re-check t-e356e3 (11-06) stays armed for bug 2, and H6 stays held.

**Next.** The operator's ready flip for #14092, then maintainer review; the t-e356e3 re-check (11-06) for bug 2. Earlier plan, now done: the fixer applies the remedy, then the [Fix Report], then the operator's ready flip (fixers cannot mark a PR ready); the t-e356e3 re-check for bug 2.
