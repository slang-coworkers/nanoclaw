---
name: project_12108_spirv_asm_internal_name_prefix
description: "#12108 prefix internal spirv_asm regs __ + parse-time assert — draft PR #12190"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0043030e-d9e3-4830-b491-b330084a69b3
---

**#12108** (shader-slang/slang) — prefix ALL internal `spirv_asm` result registers `%foo`→`%__foo` in `*.meta.slang` so their auto-emitted `OpName`s read as compiler-internal, + a parse-time `SLANG_ASSERT` catching future un-prefixed internal names at build. Follow-up to PR #12053 (fixed #12002, prefixed only `%__sampled`). Scope/solution set by **@jkwak-work**; motivated by @maxime-modulopi.

**jkwak-work asked @nv-slang-bot to make the PR** (twice: cmt 5008499085 07-17, re-ask 5051765598 07-22). Routed to slang-fixer on canonical thread `gh-issue-shader-slang/slang-12108`.

**Draft PR #12190** (07-22 22:38Z), branch `fix/issue-12108`. 5 files +352/−314: renamed 344 regs in hlsl.meta.slang + 69 in glsl.meta.slang + generated GetDimensions blocks in `slang-core-module-textures.cpp` (codex CODE_REVIEW caught these programmatic regs `%vecSize %_width %_sampleCount %_levelCount %c_*` — assert would've fired, prefixed too). Assert wired at `%id` chokepoint gated by new `ParserOptions::isCoreModule`. Core-module debug build self-checks all ~626 sites.

**OUT OF SCOPE** (do not touch): emitter auto-`OpName` loop `slang-emit-spirv.cpp:11616-11617` (intentional tested feature, `opname.slang`); debug-info-level gating of OpNames (orthogonal, @maxime-modulopi #12053).

Tests: new `tests/spirv/internal-spirv-asm-opname-prefix.slang` PASS; opname.slang + texture-sample-internal-opname.slang PASS; tests/spirv 546/546, glsl-intrinsic 246/246. codex CODE/PLAN/OUTPUT approved.

**State (07-23 20:06Z):** PR #12190 **APPROVED** by maintainer **csyonghe** (valid @HEAD `5312f49a`, reviewDecision=APPROVED); csyonghe also flipped it ready-for-review. **CI fully green** all platforms/backends/suites (mergeStateStatus=BLOCKED = normal branch-protection awaiting-human-merge, NOT a failure). report_pr_created confirmed; 5-bullet posted on issue #12108 (cmt 5052245458). slang-reviewer A/B/C pipeline now moot given maintainer approval; fixer handles any surfaced findings. **MERGE operator-gated** — fixer will NOT merge/push (a commit dismisses approval). Await human merge. No blocker.

**07-23 22:20Z:** SECOND approval — **jkwak-work** (the requester) approved "Looks good to me." Two maintainer approvals now (csyonghe + jkwak-work), CI green @5312f49a. Requester satisfied; chain wrapped pending the merge click.

**07-23 22:23Z RE-OPENED:** jkwak-work (cmt 5064121161) requested a doc update — document the new internal-`spirv_asm` `__`-prefix convention (+ parse-time assert) in `docs/design/coding-conventions.md` ("might be more than one" — sweep docs/ for siblings). In-scope maintainer-directed follow-up on same PR.

**07-23 22:30Z doc-update DONE:** commit 4a5d797f7c pushed — `docs/design/coding-conventions.md` (new "Internal spirv_asm result registers" subsection under Naming) + `docs/design/stdlib-intrinsics.md` (extended existing `__`-prefix note, cross-ref). Left `docs/generated/**` (auto-gen) + user-facing interop guide alone (convention is core-module-authoring, not user code) — flagged in PR reply so jkwak can redirect. Push dismissed the 2 approvals → **REVIEW_REQUIRED** (expected, maintainer-requested, flagged in reply); non-draft push auto-triggered real pull_request CI (no manual dispatch). codex OUTPUT_REVIEW approved doc text. **Await jkwak re-review + human merge; MERGE operator-gated.**

**07-23 23:56Z CI flake (not real):** doc commit 4a5d797 — only `test-falcor` failed (check-ci gates on it); all builds + other tests passed. Docs-only diff (2 .md) can't affect a Falcor shader test, and test-falcor PASSED on identical-code prior head 5312f49a. Fixer reran (infra retry 1/≤3), Falcor Perf sub-job already re-passed. No code action.
