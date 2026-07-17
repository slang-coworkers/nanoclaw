---
name: project_11595_byteaddressbuffer_align_block
description: "#11595 [2/3] ByteAddressBuffer wide-vs-scalarized + align contract — shadow BLOCK (RED_BUG) @R4"
metadata: 
  node_type: memory
  type: project
  originSessionId: fa537bca-750e-4a6c-9fdd-17983d46f50c
---

shader-slang/slang PR #11595 "[2/3] ByteAddressBuffer: decide wide-vs-scalarized + validate the alignment contract" (author nv-slang-bot[bot], stacked series 2/3).

**Decision: BLOCK (RED_BUG)** recorded to shadow-mode ledger at head `056c93b5b7b3` (R4) on 2026-07-16 by slang-pr-approver. NOT posted to GitHub (shadow mode = ledger-only; approver never posts). Critique-gated: DECISION_REVIEW + OUTPUT_REVIEW both approve; codex independently corroborated PR-causality from head+master test copies and both CI job logs.

**The catch (Devin missed it; challenger CI gate caught it):** the PR's new **E41303** hard-error (rejects a constant location not a multiple of its alignment promise) breaks a *pre-existing, untouched* test — `tests/bugs/gh-9931.slang.1` does `Store<DescriptorHandle>(4, h, 8)` where 4 % 8 ≠ 0 → hard compile failure (result code -1), deterministic on macOS + Linux release aarch64 (host-independent spirv-asm), survives retry. PR left the test unupdated. Same class as [[project_12046_modulus_remainder_audit]] #12130 / [[project_12099_profile_capability_conflict_diag]] #12122 (new diagnostic breaks unupdated existing test).

Tier: Devin-only (bot PR; production claude-code-action skips bot PRs, harvest exit 20). Devin 0 bugs all revisions. Clauses all 6 pass. R3 cleanup (removed dead `__naturalAlignmentOf` IR op, module ver 25→26, `getBaseAlignment`=898 append-only) was verified safe and correct — `pr: breaking change` label correct but not a policy blocker. R4 compiler code byte-identical to R3 minus dead op; regression persists.

Discipline: debounced R1→R4 synchronize churn to settled heads, re-ran full procedure each time, never recorded on incomplete CI or against superseded R3 build; reconfirmed failure from R4's own CI.

**Why:** terminal shadow verdict on a live stacked-series PR; the RED is a real CI failure (self-evident to maintainers), so no surfacing/fixer-dispatch is warranted in shadow mode. Kept for the eventual human-verdict agreement join and to avoid re-driving on further churn.

**How to apply:** if a substantive human comment or a NON-synchronize event lands on #11595, re-open via the approver on canonical thread `gh-issue-shader-slang/slang-11595`. Bare `synchronize` (new head) → approver already owns re-target/debounce; forward the heads-up, don't re-dispatch fresh. Fix path (if pursued upstream): update `gh-9931.slang.1` expectation or scope the E41303 hard-error.

**✅ 2026-07-17 01:00 — FIX PATH TAKEN (fixer msgs 41870/41872; fixer's locally-verified report, CI still IN FLIGHT — not asserting green).** Fixer resolved the R4-flagged `gh-9931.slang.1` failure **test-only**, pushed FF `056c93b5b7..05d76e40f0` to `fix/issue-11591`, replied PR #11595 (issuecomment-4997930786), CI running on the push.
- **Classification CORRECTED: real deterministic E41303 regression, NOT a flake.** `gh-9931.slang.1` = the `computeMainNV` **deterministic spirv-asm codegen** sub-test — NOT the GPU-nondeterministic sibling that **three prior fixer sessions misclassified as "NV GPU nondeterminism."** jkwak was right it's a Slang regression. (Fixer captured a shared learning on the `.slang.N` sub-test-index gotcha.)
- **Fix (right layer, not test-masking):** dropped the **false `,8` align promise** in `Store<DescriptorHandle>(4,h,8)`. Offset 4 has no honest explicit-align spelling for an 8-byte type (floor 8: any ≥8 → E41303, any <8 → E41300), so promise-less `Store(4,h)` scalarizes **identically** and preserves the exact `CHECK_NV-NOT ulong/v2uint` intent (the unaligned-descriptor path from #11430). E41303 itself is correct/jkwak-blessed — the test carried a latent false promise the new diagnostic legitimately surfaced. **= exactly the "update gh-9931.slang.1 expectation" fix path this memo named.**
- **Verified (local, fixer):** `slang-test tests/bugs/gh-9931.slang` 3/3 (incl `.2 (vk)` on local L40S — runtime, not just codegen); byte-address suite 47/47; codex PLAN+CODE+OUTPUT approve (codex independently re-ran + verified push/remote state). Compiler code untouched (test-only), so the base-align feature's prior codex-approve + review-addressed state stands.
- **Shadow-BLOCK status:** the BLOCK's premise ("PR left the test unupdated") is now **addressed**. This push = a `synchronize` event on #11595 → per this memo's own guidance, the **approver owns the debounced re-eval** (it's webhook-driven; will re-run clauses on the settled head once CI completes and should flip BLOCK→WOULD_APPROVE if E41303 no longer breaks the test). Main forwarded a lightweight heads-up (fixer's root-cause + "test-fix, not churn"), did NOT re-dispatch fresh — approver must still wait for settled CI, never record on incomplete. Next terminal = approver re-eval + eventual human verdict/merge join.
- **2026-07-17 01:09 — approver MONITOR ARMED at R5, WOULD_APPROVE STAGED (approver msg 41874).** R5 pass staged: all clauses pass, Devin clean, compiler code byte-identical to R4 (E41303 stands), challenger mechanism trace confirms the test-only fix (`Store(4,h)`→alignment 0→no E41303→scalarizes→compiles→CHECK_NV matches, NOT-intent preserved). Approver **holds recording until R5 CI settles green + reconfirms `gh-9931.slang.1` specifically passes**, then runs critique gate + records BLOCK→WOULD_APPROVE. Correct discipline (never record on incomplete CI); no Main action — webhook/monitor-driven.
