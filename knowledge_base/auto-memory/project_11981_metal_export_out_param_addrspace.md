---
name: project_11981_metal_export_out_param_addrspace
description: "In-flight — Metal export/library out/inout param crashes 'Unknown addressspace encountered'; sibling of"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1290ecd4-25ec-456d-b180-846a8c8d1c62
---

**shader-slang/slang#11981** — Metal: an `export`/public-linkage function with a mutable-ref (`out`/`inout`) param reaches Metal emission as a pointer with `AddressSpace::Generic`; emitter's addr-space switch (`slang-emit-metal.cpp:1363`) has no case → `SLANG_UNEXPECTED` "Unknown addressspace encountered".

Triager verified at HEAD 33f9ed0ce (no GPU). **Corrected the bot's own claim:** true trigger is `export` linkage on a mutable-ref param — crashes WITH or WITHOUT an entry point and WITH or WITHOUT `-whole-program` (bot's "no crash when entry point present" was INCOMPLETE). WGSL + GLSL + HLSL emit the repro cleanly → Metal-specific.

Confirmed **sibling-not-dup of [[project_11969_metal_out_param_addrspace]]** (#11969): same emitter default-arm symptom, DIFFERENT producer — #11969 is the vertex-only stage gate in `legalizeEntryPointVaryingParamsForMetal`; #11981's producer is `AddressSpaceContext::processModule()` (`slang-ir-specialize-address-space.cpp:359`) seeding its worklist only from `IREntryPointDecoration` funcs. Neither fix subsumes the other.

Recommended fix = Approach A (producer-side): seed HLSLExport/Public funcs in `processModule` + default unspecialized mutable-ref params to `thread` (`AddressSpace::ThreadLocal`).

**State (updated 2026-07-09):** DRAFT PR **#12014** opened — https://github.com/shader-slang/slang/pull/12014 — per maintainer jkwak-work green-light ("make a PR with 'producer-side fix'"). Approach A shipped: new `getDefaultAddressSpaceForExportedFunctionParam` virtual (base=`Generic`, Metal=`ThreadLocal`); `processModule` split-concern seeding of exported funcs; `tests/metal/export-out-param.slang` added. 4 files, +211. Non-Metal byte-identical by construction. `slang-test` export-out-param + out-param regression both PASS; codex gate all-green (PLAN/CODE/OUTPUT); dispatched to slang-reviewer. CI red on draft = priority-yield cosmetic (wait-for-human-priority + check-ci only; builds skipped) — NOT a real failure; real pull_request CI fires on maintainer ready-flip.

## ✅ UPSTREAM RE-VERIFIED 2026-08-03 (Main) — draft genuinely STALE, but 2 of 3 "owed" items were ALREADY DISCHARGED

Issue **#11981 OPEN**. PR **#12014**: `draft:true`, head **`2e8c12db841f`**, **untouched since 07-09T01:47Z (~25 days)**, branch `fix/issue-11981`, author `nv-slang-bot`, assignee+reviewers `jkwak-work`/`juliusikkala`; it is the **ONLY** PR referencing #11981 ⇒ **this stall is REAL** — unlike #12110's, which I had fabricated by triaging on my own note instead of upstream state.

⚠️**Re-checking each owed ITEM individually showed I'd have chased work already done:**
- ✅ **public 5-bullet footprint IS posted on #11981** — `nv-slang-bot` 07-09T01:52Z, *"Triage → fix in draft PR #12014, held pending review"*, following jkwak's *"Please make a PR with producer-side fix"*.
- ✅ **bot disclaimer IS present** in the 11,954-char PR body.
- ❌ **Only genuinely open: `report_pr_created(12014)` was never called** ⇒ that PR's webhook events still fall through to branch-prefix resolution.

⭐**"OWED" markers age too — re-verify each owed ITEM, not just the gate.** A stale owed-list misleads exactly as much as a stale status. Branch `fix/issue-11981` ⇒ fixer-owned by routing convention, but the fixer swept its store and holds no entry ⇒ **unowned live chain**. **RESUME:** have the fixer call `report_pr_created(12014)`, or nudge jkwak on the ~25d-stale draft.

**Held pending maintainer review/ready-flip — bot does NOT flip ready or merge (gated).** Draft-held rule: `Closes #11981` in a draft doesn't surface, so triager tasked (msg157) to post the "triaged → fix in draft PR #12014, held" 5-bullet on the issue for public footprint, and to confirm the fixer called `report_pr_created(12014)`. Peer-wired triager→fixer; do NOT double-dispatch. Was: triage done, comment PATCHED, awaiting [Fix Report] — now [Fix Report] received. Classification: bug / medium / P2.

**⚠️ 2026-07-09 ~08:38 — #12014 `report_pr_created` still OWED by owning session.** The #11969 fixer session confirmed it correctly did NOT call `report_pr_created(12014)` (not its PR). The session that OWNS #12014 (head `2e8c12db84`) must make that call — until it does, #12014 webhook events have no session mapping and fall through to branch-prefix resolution ([[feedback_verify_report_pr_created]]). Verify + route through #11981's owning fixer/triager if the chain stays active.

**⚠️ 2026-07-09 ~02:59 — #12014 guardrail flag (surfaced by #11969 fixer, read-only, NOT acted on).** PR #12014 currently has: assignee `jkwak-work`, review-requests `jkwak-work` + `juliusikkala`, and NO bot disclaimer. The `jkwak-work` assignee/review-request matches the forbidden auto-add the #11969 fixer just stripped from #12015 — BUT jkwak-work is the maintainer who green-lit #11981, so this may be legitimate self-engagement, not an auto-add slip; `juliusikkala` (real maintainer) can't be disambiguated legit-vs-auto either. **#12014's OWNING session must reconcile** (strip any auto-added no-reviewer/no-assignee, add bot disclaimer) — Main does NOT reach cross-chain to do this; route through #11981's owning fixer/triager if it stays active. Low-priority; recorded so it isn't dropped.

## ✅⛔ 2026-08-07 04:31Z — RE-VERIFIED AT NEW HEAD, **DO NOT CLOSE**. And two supervisor-input defects are MINE.

**MINE-VERIFIED at source, every claim in the fixer's report:**
- **PR #12014**, head **`76c989d87d2dc04f1bdda0990ab807af68da2848`**, draft, **4 files / +211/−0**,
  `pr: non-breaking`, `BLOCKED`/`REVIEW_REQUIRED`, **reviews 0 / comments 0**, assignee **jkwak-work**.
- **Genuine MERGE, not a rebase** — two parents `2e8c12db84` + `88fa1206d3`, *"Merge remote-tracking branch
  'origin/master' into fix/issue-11981"*. History preserved, per jhelferty's directive.
- **NOT SUPERSEDED — closing would discard a live fix.** Master still seeds the address-space worklist only
  from `IREntryPointDecoration` (`slang-ir-specialize-address-space.cpp:370`), the exact root cause, and
  `getDefaultAddressSpaceForExportedFunctionParam` has **0 occurrences** on master.
- **The stale citation is real and its fix is exact:** `slang-emit-metal.cpp:1397` is
  `SLANG_UNEXPECTED("Unknown addressspace encountered.");` — it reported the drift 1363→1397. Confirmed to the
  line. ⭐**Its rule from that near-miss is the transferable one: a MERGE can stale a citation into a file you
  never touched, so after merging upstream re-verify citations to files the MERGE touched, not just yours.**
  Its first draft had inferred "citations still hold" from *our files are byte-identical* — a wrong inference
  caught by the critique gate.

## ⛔⭐⭐⭐ TWO DEFECTS IN MY OWN SUPERVISOR'S INPUTS — both confirmed, and the second is a rule-vs-execution gap

1. **"CI-green" was a FALSE GREEN.** The `CI` run at the old head was `conclusion=skipped` — **41 of 45 checks
   SKIPPED behind the draft gate**, the 4 successes being `board-sync`, 2× `reuse-compliance-check`,
   `license/cla`. ⇒ **No build or test job has EVER executed on this PR in 29 days**; runs exist, but each
   either skipped on the draft gate or priority-yielded before builds started.
   ⚠️**The rule to prevent this is ALREADY in `/supervise-issues`** (*"never assert green from
   `statusCheckRollup`; census `commits/<sha>/check-runs` and count `^(build|test|sanitizer)` with a
   non-skipped conclusion"*) — **and the nudge was emitted anyway.** ⇒ ⭐⭐⭐**Editing the rule text again
   would fix nothing; the rule exists and was not executed.** The fix is to make the nudge template
   **carry the non-skipped build/test count as a REQUIRED field**, so a nudge cannot be generated without it —
   *convert the rule into a default*
   ([[feedback_evidence_hygiene_across_agents_2026_08_07]]).
2. **"29.0d idle" measured the wrong party.** `2e8c12db84` was authored by **jkwak-work (Jay Kwak),
   2026-07-09T01:47:09Z** — the maintainer's own catch-up merge on our bot branch — and he requested this PR
   himself (#11981, 07-09T01:11Z *"Please make a PR with 'producer-side fix'."*). ⇒ **an engaged maintainer,
   not a dropped chain.** Last-activity conflates *"the bot is sitting on it"* with *"nobody touched it"*.
   **Attribute the head commit's author before calling a chain idle.**

⇒ **The fixer correctly declined to nudge him and declined to post a new issue comment** (the issue already
carries the 5-bullet naming #12014). Both were the right calls and the nudge that prompted otherwise was wrong.

**CI:** run `31146430426` = priority-yield, not a failure — 33/36 skipped, failures only `wait-for-human-priority`
+ `check-ci`, log verbatim `priority-gate-yielded: higher-priority CI is active`. ⭐**A yielded run ages out at
12 h** (`ci.yml:109` `--max-yield-hours 12`) — worth knowing as the natural resume bound.

⚠️**Evidence provenance, stated by the fixer and worth preserving:** the test figures (repro 2/2, Metal
199/199 with 145 GPU-gated ignored, `E99997` count 0, pre-fix binary still erroring on the same input, both
changed TUs compiled count=2) were **measured by a delegated build subagent**, with the fixer verifying its
artifacts plus the git/CI facts directly. `clang-format 17.0.6` came from a **pip wheel in a venv, not CI's
toolchain** ⇒ treat the formatting pass as a local check, not a CI-equivalent one.

**RESUME:** jkwak-work. Nothing owed from us. **Do NOT close on a supervisor "idle" or "green" reading —**
both were measured wrong here, and the fix is absent from master.
