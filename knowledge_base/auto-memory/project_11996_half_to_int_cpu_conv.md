---
name: project_11996_half_to_int_cpu_conv
description: #11996 CPU/LLVM half→scalar conversion ops — PR #12043 maintainer-flipped ready 07-10 (skiminki-nv); approver deciding (LIVE, head ace048a2)
metadata: 
  node_type: memory
  type: project
  originSessionId: 23386a98-c62c-441a-9263-aea120ad3458
---

**PR: [#12043](https://github.com/shader-slang/slang/pull/12043) — MAINTAINER-FLIPPED READY 2026-07-10T11:36:19Z by skiminki-nv** (maintainer; intended path, drafts-only guardrail satisfied — NO breach). review_requested by skiminki-nv (11:36) + jhelferty-nv (10:51). Approver running `/slang-pr-approve` LIVE, decision binds to head `ace048a26b2a`. CI at head: `workflow_dispatch` "CI" run = cosmetic red (priority-yield, benign, confirmed); authoritative `pull_request` "CI" run (11:36:22Z) IN_PROGRESS at flip — head-green pending, not red; other pull_request checks green/skipped. Policy `require_ci_green=false` so CI doesn't gate Step 1.

**Reviews + CI (Main-verified at source 2026-07-11 00:50Z):** 2 maintainer APPROVEs — juliusikkala (07-10 11:13Z "acceptable minimal fix"; wants native `_Float16`-under-LLVM investigated separately) + skiminki-nv (13:07Z "LGTM"). jkwak-work **CHANGES_REQUESTED** 07-11 00:29Z = **investigation hold, 0 inline comments** ("Claude is telling me this PR caused intermittent failures … I am investigating") — NOT an edit list; do not treat as change requests. skiminki enqueued to merge queue twice (13:07Z, 14:53Z), both **evicted** on RED (14:19Z, 21:36Z). Those reds are REAL `merge_group` runs (full suite) but **flake-consistent**: JSON-RPC transport drop (`waitForResult()`→`rpc failed`), non-deterministic (run 29109328396=`static-const-vector-array.slang.3 syn (llvm)`; run 29109329627=`static-const-matrix-array.slang.3 syn (llvm)`), float vector/matrix tests untouched by the `struct half` diff → matches test-server RPC flake family [[project_11951_testserver_jsonrpc_pathlevel_flake]] (jkwak-work owns it, NO bot fixer). Fixer parentage arg verified: `e5561b8f`(#12043 queue commit) is 1-commit ancestor of `ec99385f`(#11910 queue commit). Public refutation issuecomment-4940847626 sound. **Fixer msg #50 stale on one point: called PR "draft, held" — it is NOT (maintainer-flipped ready); harmless (evicted from queue, pushes not gated).**

**Prior draft history:** opened 2026-07-10 draft, head `fix/issue-11996`→master, `pr: non-breaking`, assignee jkwak-work, reviewers juliusikkala+jkwak-work. Main-verified while draft: `draft:true`/`merged_at:null`; 13 files +39/−24. Repro RED→GREEN, all 12 re-enabled `-cpu` conversion tests pass, conversions 48/48 + language-feature 2121/2121 (lone `scalar-bf16 (vk)` pre-existing/OOB). codex-critique PLAN/CODE/OUTPUT APPROVE. `report_pr_created` + issue footprint asserted done.

**Next: approver verdict (WOULD_APPROVE | ABSTAIN_* | BLOCK) on canonical thread → human ready-flip already done → merge gated (operator). Approver decision is non-mutating (ledger only, nothing posts).**

**Blocker (07-11 00:49Z, Main-verified):** jkwak-work attributed his flagged intermittency to **his own PR [#12060](https://github.com/shader-slang/slang/pull/12060)** ("Fix ASan merge queue failures", addresses **#11833**; open non-draft; render-test-host ASan heap-overflow on merge-queue sanitizer jobs) — comment 00:49:33Z links it as "the fix for the intermittency." OUTSIDE #12043's blast radius (verified). Note: fixer's own two-run refutation diagnosed a JSON-RPC drop (#11951 family, test-slang GPU job) — a DIFFERENT flake family than jkwak's ASan fix; jkwak owns both + named his own fix, so it's his maintainer call (bot ack issuecomment-4940875872 deferential, correct). jkwak's CHANGES_REQUESTED stands until #12060 lands + queue clean → he re-reviews. Not actionable on our side; NO bot fixer on #11833/#11951 (jkwak-work owns). Fixer holding + peer combined-review pending (2 non-blocking advisories to batch in one push).

**Routing note:** fixer reported [Fix Report]s (#50, #52) DIRECTLY to Main, tier-skipping the triager (who owns the fixer peer-wire). Mild topology drift, harmless — fixer is holding correctly, nothing missed. Do NOT reply-with-direction to fixer (would establish unwanted Main→fixer driving edge); if a correction is ever needed, route it through the triager.

**shader-slang/slang#11996** — CPU/LLVM backend rejects direct `half`→integer cast (`(int8_t)half`) with "cannot convert 'half' to 'int8_t' without a conversion operator"; `(int8_t)(float)half` works.

**State (2026-07-08):** IN-FLIGHT. Triaged bug / medium / P2 / CPU-C++ target-emit; reproduced on ToT (`33f9ed0ce`, llvm 21.1) — `-cpu` fails, `-cuda` passes. Verdict posted → [issuecomment-4914502883](https://github.com/shader-slang/slang/issues/11996#issuecomment-4914502883); `reproduced` label applied; author-set Issue Type "Language Maturity" left untouched. Not a confirmed regression, no dup.

**Root cause (verified):** under `SLANG_LLVM`, native `_Float16` gated out → `half` resolves to fallback `struct half` in `prelude/slang-cpp-scalar-intrinsics.h` which declares only `explicit operator float()`. Emitter lowers `(int8_t)half` to one `kIROp_CastFloatToInt` → functional cast `int8_t(h)`; explicit-operator-float does NOT chain through a single cast (confirmed clang++ + g++).

**Approach A (fixer dispatched):** add `explicit` scalar conversion operators (int8/16/32/64 ±, double, bool) to fallback `struct half`, each via `load()`; add reporter's CPU compute repro as regression test. Compile-validated on clang+gcc.

**Human comments dispositioned (triager, closest-to-state, verified):**
- juliusikkala (07-09): "only C++ emitter, not LLVM IR emitter?" → YES confirmed at code level (a97110a43); direct IR path uses native `CreateFPToSI/FPToUI`, no prelude struct. [issuecomment-4928191723](https://github.com/shader-slang/slang/issues/11996#issuecomment-4928191723).
- skiminki-nv (07-10, 3 parts): (1) confirmed fix location = fallback `struct half` L670; (2) "integer→half also missing" → NO, verified empirically (fe284bf9f, -DSLANG_LLVM): int→half & double→half already compile via `explicit half(float)` ctor; only from-half set was broken → fix correctly scoped, no widening; (3) rounding/emulation (double-rounding, stdlib-vs-emulation-lib, front-end half-literal) acknowledged valid but kept EXPLICITLY unresolved by operator fix → filed follow-up **#12042** (maintainer design question), linked back. Reply [issuecomment-4933932554](https://github.com/shader-slang/slang/issues/11996#issuecomment-4933932554).

**Related:** follow-up **#12042** — half arithmetic double-rounding / stdlib-vs-emulation-library, open maintainer design question. Watch for webhooks.

**Routing:** triager owns the fixer peer-wire — dispatched via triager, NOT direct Main→fixer. Do NOT double-dispatch. Fixer build interrupted by session teardown (~593/1170) 07-10, restarting incremental; then repro + broader half suite + draft PR; also checking #12020's disabled `-cpu` scalar-conversion test lines. Awaiting fixer's [Fix Report]/PR; verify `report_pr_created` when PR opens. Canonical thread `gh-issue-shader-slang/slang-11996`.
